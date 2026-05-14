const prisma = require('../utils/prisma');
const { getMonthKey, endOfCurrentMonthUtc } = require('../utils/credits');
const dodo = require('../utils/dodo');

// ─── Plan + top-up config (single source of truth) ────────────────────────────
const PLAN_CONFIG = {
  STARTER: { monthlyCredits: 45000,  priceUSD: 4.99  },
  CREATOR: { monthlyCredits: 210000, priceUSD: 18.99 },
  PRO:     { monthlyCredits: 850000, priceUSD: 79.99 },
};

const TOPUP_CONFIG = [
  { amountUSD: 1,  credits: 5000  },
  { amountUSD: 5,  credits: 25000 },
  { amountUSD: 10, credits: 55000 },
];

const MAX_TOPUP_USD = 1000;

const getTopUpCredits = (amountUSD) => {
  const tier = TOPUP_CONFIG.find(t => t.amountUSD === amountUSD);
  return tier ? tier.credits : Math.round(amountUSD * 5000);
};

const isDuplicateTxn = (err) => err && err.code === 'P2002';

// ─── Transaction History ──────────────────────────────────────────────────────
const getTransactions = async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const transactions = await prisma.creditTransaction.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        amount: true,
        type: true,
        description: true,
        referenceId: true,
        createdAt: true,
      },
    });

    res.json({ transactions });
  } catch (error) {
    console.error('Transaction History Error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
};

const getPlanConfig = (req, res) => {
  res.json({
    plans: PLAN_CONFIG,
    topups: TOPUP_CONFIG,
    dodoEnabled: dodo.isEnabled(),
  });
};

// ─── Dodo Payments: checkout session creation ────────────────────────────────
// Stacking: a user can buy any plan, any quantity. Each call to this endpoint
// creates a brand-new Dodo subscription → one new Subscription row on our
// side. No "already has a sub" gate.
//
// Credits are NOT granted here — the webhook handler is the only path that
// grants credits, so a hijacked frontend can't manufacture money.
const createDodoCheckout = async (req, res) => {
  try {
    if (!dodo.isEnabled()) {
      return res.status(503).json({ error: 'Dodo Payments is not enabled' });
    }

    const { kind, amountUSD, plan } = req.body || {};

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, dodoCustomerId: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (kind === 'topup') {
      if (!Number.isFinite(amountUSD) || amountUSD < 1 || amountUSD > MAX_TOPUP_USD) {
        return res.status(400).json({ error: `Amount must be between $1 and $${MAX_TOPUP_USD}` });
      }
      const validTier = TOPUP_CONFIG.some(t => t.amountUSD === amountUSD);
      if (!validTier) {
        return res.status(400).json({ error: 'Top-up amount must match a configured tier ($1, $5, $10)' });
      }

      const { checkoutUrl, sessionId } = await dodo.createTopUpCheckout({
        userId: user.id,
        email: user.email,
        name: user.name,
        amountUSD,
        dodoCustomerId: user.dodoCustomerId,
      });
      return res.json({ checkoutUrl, sessionId });
    }

    if (kind === 'plan') {
      const planKey = (plan || '').toUpperCase();
      if (!PLAN_CONFIG[planKey]) {
        return res.status(400).json({ error: 'Invalid plan. Must be STARTER, CREATOR, or PRO.' });
      }

      const { checkoutUrl, sessionId } = await dodo.createPlanCheckout({
        userId: user.id,
        email: user.email,
        name: user.name,
        planKey,
        dodoCustomerId: user.dodoCustomerId,
      });
      return res.json({ checkoutUrl, sessionId });
    }

    return res.status(400).json({ error: "kind must be 'topup' or 'plan'" });
  } catch (error) {
    console.error('Dodo Checkout Error:', error);
    res.status(500).json({ error: 'Failed to create Dodo checkout session', details: error.message });
  }
};

// ─── Dodo Payments: webhook handler ──────────────────────────────────────────
// MUST be mounted with a raw-body parser BEFORE express.json so the SDK can
// verify the HMAC signature against the exact bytes sent by Dodo.
//
// Idempotency:
//   • Top-ups       — unique(AddonGrant.dodoPaymentId) blocks replays.
//   • Subscriptions — unique(Subscription.dodoSubscriptionId) plus a
//                     CreditTransaction marker per (sub, month) for renewals.
const handleDodoWebhook = async (req, res) => {
  if (!dodo.isEnabled()) {
    return res.status(503).json({ error: 'Dodo Payments is not enabled' });
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');

  let event;
  try {
    event = dodo.verifyWebhook(rawBody, req.headers);
  } catch (err) {
    console.error('Dodo webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  try {
    await processDodoEvent(event);
  } catch (err) {
    console.error('Dodo webhook processing error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  res.json({ received: true });
};

// Maps a webhook payload back to our internal userId. Prefers metadata.userId
// (set when we created the checkout session); falls back to looking up the
// existing Subscription row by dodoSubscriptionId for renewals/cancellations
// where the metadata may not be present.
const resolveUserIdFromEvent = async (data) => {
  const fromMetadata = data && data.metadata && data.metadata.userId;
  if (fromMetadata) return fromMetadata;

  if (data && data.subscription_id) {
    const sub = await prisma.subscription.findUnique({
      where: { dodoSubscriptionId: data.subscription_id },
      select: { userId: true },
    });
    if (sub) return sub.userId;
  }
  return null;
};

const processDodoEvent = async (event) => {
  const { type, data } = event || {};
  if (!type || !data) return;

  // ── One-time payment (top-up) ──────────────────────────────────────────────
  if (type === 'payment.succeeded') {
    if (data.subscription_id) return; // subscription payments are handled below
    const userId = await resolveUserIdFromEvent(data);
    if (!userId) {
      console.error('payment.succeeded without resolvable userId, payment_id:', data.payment_id);
      return;
    }

    const amountUSD = Number(data.metadata && data.metadata.amountUSD);
    const credits = Number.isFinite(amountUSD) ? getTopUpCredits(amountUSD) : null;
    if (!credits) {
      console.error('payment.succeeded with unknown amountUSD metadata; cannot credit:', data.payment_id);
      return;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.addonGrant.create({
          data: {
            userId,
            creditsRemaining: credits,
            originalAmount: credits,
            amountUSD: Math.round(amountUSD),
            dodoPaymentId: data.payment_id,
          },
        });
        await tx.creditTransaction.create({
          data: {
            userId,
            amount: credits,
            type: 'ADDON_TOPUP',
            description: `Dodo top-up of $${amountUSD.toFixed(2)} — ${credits.toLocaleString()} permanent credits`,
            referenceId: data.payment_id,
          },
        });
        await tx.user.update({
          where: { id: userId },
          data: {
            creditsBalance: { increment: credits },
            addonCredits: { increment: credits },
            ...(data.customer && data.customer.customer_id
              ? { dodoCustomerId: data.customer.customer_id }
              : {}),
          },
        });
      });
    } catch (err) {
      if (isDuplicateTxn(err)) return; // replay — addon grant or marker already exists
      throw err;
    }
    return;
  }

  // ── Subscription activated / renewed ──────────────────────────────────────
  // Activation: first successful charge on a brand-new subscription. Create
  // the Subscription row, grant the full monthly bucket, increment cached
  // user balance.
  // Renewal: reset that subscription's bucket back to monthlyCredits and push
  // currentPeriodEnd. A MONTHLY_RESET marker (per-sub, per-month) keeps this
  // idempotent against webhook retries.
  if (type === 'subscription.active' || type === 'subscription.renewed') {
    const userId = await resolveUserIdFromEvent(data);
    if (!userId) {
      console.error(`${type} without resolvable userId, subscription_id:`, data.subscription_id);
      return;
    }

    const planKey = (data.metadata && data.metadata.planKey)
      || (data.product_id ? dodo.lookupPlanByProductId(data.product_id) : null);
    if (!planKey || !PLAN_CONFIG[planKey]) {
      console.error(`${type} for unknown plan, subscription_id:`, data.subscription_id, 'product_id:', data.product_id);
      return;
    }

    const config = PLAN_CONFIG[planKey];
    const monthKey = getMonthKey(new Date());
    const nextPeriodEnd = data.next_billing_date
      ? new Date(data.next_billing_date)
      : endOfCurrentMonthUtc();

    // Marker key is scoped to the specific subscription_id so two simultaneous
    // subscriptions on the same plan don't share a single marker.
    const markerRef = `dodo_sub_${data.subscription_id}_${monthKey}`;
    const existingMarker = await prisma.creditTransaction.findFirst({
      where: { userId, type: 'MONTHLY_RESET', referenceId: markerRef },
      select: { id: true },
    });
    if (existingMarker) return; // replay — already applied

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.subscription.findUnique({
          where: { dodoSubscriptionId: data.subscription_id },
          select: { id: true, creditsRemaining: true },
        });

        let delta;
        if (existing) {
          // Renewal (or replay we already filtered above — defensive)
          delta = config.monthlyCredits - existing.creditsRemaining;
          await tx.subscription.update({
            where: { id: existing.id },
            data: {
              planKey,
              monthlyCredits: config.monthlyCredits,
              creditsRemaining: config.monthlyCredits,
              status: 'ACTIVE',
              autoRenew: true,
              currentPeriodEnd: nextPeriodEnd,
              canceledAt: null,
            },
          });
        } else {
          // Activation — brand-new subscription. createdAt set to now defines
          // its position in the FIFO drain order.
          delta = config.monthlyCredits;
          await tx.subscription.create({
            data: {
              userId,
              planKey,
              monthlyCredits: config.monthlyCredits,
              creditsRemaining: config.monthlyCredits,
              status: 'ACTIVE',
              autoRenew: true,
              currentPeriodEnd: nextPeriodEnd,
              dodoSubscriptionId: data.subscription_id,
            },
          });
        }

        await tx.creditTransaction.create({
          data: {
            userId,
            amount: delta,
            type: 'MONTHLY_RESET',
            description: type === 'subscription.active'
              ? `Dodo: activated ${planKey} — ${config.monthlyCredits.toLocaleString()} credits`
              : `Dodo: ${planKey} renewed for ${monthKey} — ${config.monthlyCredits.toLocaleString()} credits`,
            referenceId: markerRef,
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: {
            creditsBalance: { increment: delta },
            ...(data.customer && data.customer.customer_id
              ? { dodoCustomerId: data.customer.customer_id }
              : {}),
          },
        });
      });
    } catch (err) {
      if (isDuplicateTxn(err)) return; // raced — another worker applied it
      throw err;
    }
    return;
  }

  // ── Subscription cancelled (scheduled to expire at period end) ────────────
  if (type === 'subscription.cancelled') {
    if (!data.subscription_id) return;
    await prisma.subscription.update({
      where: { dodoSubscriptionId: data.subscription_id },
      data: {
        status: 'CANCELED',
        autoRenew: false,
        canceledAt: data.cancelled_at ? new Date(data.cancelled_at) : new Date(),
      },
    }).catch(err => console.error('subscription.cancelled DB update failed:', err.message));
    return;
  }

  // ── Subscription on hold — dunning in progress ────────────────────────────
  if (type === 'subscription.on_hold') {
    if (!data.subscription_id) return;
    await prisma.subscription.update({
      where: { dodoSubscriptionId: data.subscription_id },
      data: { status: 'ON_HOLD', autoRenew: false },
    }).catch(err => console.error('subscription.on_hold DB update failed:', err.message));
    return;
  }

  // ── Subscription failed — initial charge or dunning exhausted ─────────────
  if (type === 'subscription.failed') {
    if (!data.subscription_id) {
      console.warn('Dodo subscription.failed without subscription_id:', data.error_message || '');
      return;
    }
    await prisma.subscription.update({
      where: { dodoSubscriptionId: data.subscription_id },
      data: { status: 'FAILED', autoRenew: false },
    }).catch(err => console.error('subscription.failed DB update failed:', err.message));
    return;
  }

  // ── Subscription expired — drop the bucket, mark EXPIRED ──────────────────
  if (type === 'subscription.expired') {
    if (!data.subscription_id) return;
    try {
      await prisma.$transaction(async (tx) => {
        const sub = await tx.subscription.findUnique({
          where: { dodoSubscriptionId: data.subscription_id },
          select: { id: true, userId: true, creditsRemaining: true, status: true },
        });
        if (!sub || sub.status === 'EXPIRED') return;
        if (sub.creditsRemaining > 0) {
          await tx.user.update({
            where: { id: sub.userId },
            data: { creditsBalance: { decrement: sub.creditsRemaining } },
          });
        }
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: 'EXPIRED', creditsRemaining: 0 },
        });
      });
    } catch (err) {
      console.error('subscription.expired processing failed:', err.message);
    }
    return;
  }

  // ── Plan changed via Dodo's customer portal ───────────────────────────────
  // We don't expose plan-change through our UI yet, but Dodo can do it from
  // their hosted portal. Refresh the subscription's plan + bucket defensively.
  if (type === 'subscription.plan_changed') {
    if (!data.subscription_id) return;
    const planKey = (data.metadata && data.metadata.planKey)
      || (data.product_id ? dodo.lookupPlanByProductId(data.product_id) : null);
    if (!planKey || !PLAN_CONFIG[planKey]) {
      console.warn('plan_changed for unknown plan, subscription_id:', data.subscription_id, 'product_id:', data.product_id);
      return;
    }
    const config = PLAN_CONFIG[planKey];
    const nextPeriodEnd = data.next_billing_date ? new Date(data.next_billing_date) : undefined;

    try {
      await prisma.$transaction(async (tx) => {
        const sub = await tx.subscription.findUnique({
          where: { dodoSubscriptionId: data.subscription_id },
          select: { id: true, userId: true, creditsRemaining: true },
        });
        if (!sub) return;
        const delta = config.monthlyCredits - sub.creditsRemaining;
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            planKey,
            monthlyCredits: config.monthlyCredits,
            creditsRemaining: config.monthlyCredits,
            status: 'ACTIVE',
            autoRenew: true,
            ...(nextPeriodEnd ? { currentPeriodEnd: nextPeriodEnd } : {}),
            canceledAt: null,
          },
        });
        await tx.user.update({
          where: { id: sub.userId },
          data: { creditsBalance: { increment: delta } },
        });
      });
    } catch (err) {
      console.error('subscription.plan_changed processing failed:', err.message);
    }
    return;
  }

  // ── subscription.updated — Dodo emits these for assorted state changes ────
  // We already react to the specific events above; this is just a log so we
  // know an update flew past without dedicated handling.
  if (type === 'subscription.updated') {
    return;
  }

  // ── Payment async-processing notice ───────────────────────────────────────
  if (type === 'payment.processing') {
    return;
  }

  if (type === 'payment.failed') {
    console.warn('Dodo payment.failed:', data.payment_id || data.subscription_id, data.error_message || '');
    return;
  }

  // Disputes, refunds, credit.* internal events, etc. — ignored for now.
};

// ─── Subscription endpoints (per-subscription, since users can stack) ─────────

const getSubscriptions = async (req, res) => {
  try {
    const subs = await prisma.subscription.findMany({
      where: {
        userId: req.userId,
        status: { in: ['ACTIVE', 'CANCELED', 'ON_HOLD', 'FAILED'] },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        planKey: true,
        monthlyCredits: true,
        creditsRemaining: true,
        status: true,
        autoRenew: true,
        currentPeriodEnd: true,
        canceledAt: true,
        createdAt: true,
      },
    });
    res.json({ subscriptions: subs });
  } catch (error) {
    console.error('getSubscriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
};

// Loads the requested subscription and confirms it belongs to req.userId.
// Returns null + sends an error response if not found.
const loadSubscriptionForUser = async (req, res) => {
  const subscriptionId = req.params.subscriptionId;
  if (!subscriptionId) {
    res.status(400).json({ error: 'subscriptionId is required' });
    return null;
  }
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      userId: true,
      planKey: true,
      status: true,
      autoRenew: true,
      currentPeriodEnd: true,
      dodoSubscriptionId: true,
    },
  });
  if (!sub || sub.userId !== req.userId) {
    res.status(404).json({ error: 'Subscription not found' });
    return null;
  }
  return sub;
};

const cancelSubscription = async (req, res) => {
  try {
    const sub = await loadSubscriptionForUser(req, res);
    if (!sub) return;

    if (sub.status === 'CANCELED' || sub.autoRenew === false) {
      return res.status(400).json({
        error: 'Subscription is already cancelled.',
        currentPeriodEnd: sub.currentPeriodEnd,
      });
    }
    if (sub.status === 'EXPIRED' || sub.status === 'FAILED') {
      return res.status(400).json({ error: 'Subscription is no longer active.' });
    }

    if (dodo.isEnabled() && sub.dodoSubscriptionId) {
      try {
        await dodo.cancelDodoSubscription(sub.dodoSubscriptionId, { reason: 'user-initiated' });
      } catch (err) {
        // Reconcile with live Dodo state — if it already reflects "cancel
        // scheduled" or has fully cancelled, proceed with the local update
        // instead of bouncing the user with a 502.
        let reconciled = false;
        try {
          const live = await dodo.getDodoSubscription(sub.dodoSubscriptionId);
          if (live && (live.cancel_at_next_billing_date === true
            || live.status === 'cancelled'
            || live.status === 'expired')) {
            reconciled = true;
          }
        } catch (lookupErr) {
          console.error('Dodo reconcile lookup failed:', lookupErr.message);
        }
        if (!reconciled) {
          console.error('Dodo cancel API failed:', err.message);
          return res.status(502).json({ error: 'Failed to cancel subscription with payment provider' });
        }
      }
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'CANCELED',
        autoRenew: false,
        canceledAt: new Date(),
      },
      select: {
        id: true, planKey: true, status: true, autoRenew: true,
        currentPeriodEnd: true, canceledAt: true, creditsRemaining: true,
      },
    });

    res.json({
      message: 'Subscription cancelled. You keep access until the end of your billing period.',
      subscription: updated,
    });
  } catch (error) {
    console.error('cancelSubscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

const resumeSubscription = async (req, res) => {
  try {
    const sub = await loadSubscriptionForUser(req, res);
    if (!sub) return;

    if (sub.currentPeriodEnd && sub.currentPeriodEnd <= new Date()) {
      return res.status(400).json({ error: 'Billing period has ended. Please re-subscribe.' });
    }
    if (sub.status === 'ACTIVE' && sub.autoRenew) {
      return res.status(400).json({ error: 'Subscription is already active.' });
    }
    if (sub.status === 'EXPIRED' || sub.status === 'FAILED') {
      return res.status(400).json({ error: 'Subscription is no longer resumable.' });
    }

    if (dodo.isEnabled() && sub.dodoSubscriptionId) {
      try {
        await dodo.resumeDodoSubscription(sub.dodoSubscriptionId);
      } catch (err) {
        let reconciled = false;
        try {
          const live = await dodo.getDodoSubscription(sub.dodoSubscriptionId);
          if (live && live.cancel_at_next_billing_date === false && live.status === 'active') {
            reconciled = true;
          }
        } catch (lookupErr) {
          console.error('Dodo reconcile lookup failed:', lookupErr.message);
        }
        if (!reconciled) {
          console.error('Dodo resume API failed:', err.message);
          return res.status(502).json({ error: 'Failed to resume subscription with payment provider' });
        }
      }
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        autoRenew: true,
        canceledAt: null,
      },
      select: {
        id: true, planKey: true, status: true, autoRenew: true,
        currentPeriodEnd: true, canceledAt: true, creditsRemaining: true,
      },
    });

    res.json({
      message: 'Subscription resumed. Auto-pay is on.',
      subscription: updated,
    });
  } catch (error) {
    console.error('resumeSubscription error:', error);
    res.status(500).json({ error: 'Failed to resume subscription' });
  }
};

const setAutoPay = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: '`enabled` must be a boolean' });
    }

    const sub = await loadSubscriptionForUser(req, res);
    if (!sub) return;

    if (sub.currentPeriodEnd && sub.currentPeriodEnd <= new Date()) {
      return res.status(400).json({ error: 'Billing period has ended.' });
    }
    if (sub.status === 'EXPIRED' || sub.status === 'FAILED') {
      return res.status(400).json({ error: 'Subscription is no longer adjustable.' });
    }

    // Auto-pay toggle = enable/disable scheduled cancellation in Dodo.
    if (dodo.isEnabled() && sub.dodoSubscriptionId) {
      try {
        if (enabled) {
          await dodo.resumeDodoSubscription(sub.dodoSubscriptionId);
        } else {
          await dodo.cancelDodoSubscription(sub.dodoSubscriptionId, { reason: 'auto-pay-disabled' });
        }
      } catch (err) {
        let reconciled = false;
        try {
          const live = await dodo.getDodoSubscription(sub.dodoSubscriptionId);
          if (live) {
            const onMatches = live.cancel_at_next_billing_date === false && live.status === 'active';
            const offMatches = live.cancel_at_next_billing_date === true
              || live.status === 'cancelled'
              || live.status === 'expired';
            if ((enabled && onMatches) || (!enabled && offMatches)) reconciled = true;
          }
        } catch (lookupErr) {
          console.error('Dodo reconcile lookup failed:', lookupErr.message);
        }
        if (!reconciled) {
          console.error('Dodo auto-pay toggle failed:', err.message);
          return res.status(502).json({ error: 'Failed to update auto-pay with payment provider' });
        }
      }
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        autoRenew: enabled,
        status: enabled ? 'ACTIVE' : 'CANCELED',
        canceledAt: enabled ? null : new Date(),
      },
      select: {
        id: true, planKey: true, status: true, autoRenew: true,
        currentPeriodEnd: true, canceledAt: true, creditsRemaining: true,
      },
    });

    res.json({
      message: enabled
        ? 'Auto-pay enabled.'
        : 'Auto-pay disabled. Plan ends at period end.',
      subscription: updated,
    });
  } catch (error) {
    console.error('setAutoPay error:', error);
    res.status(500).json({ error: 'Failed to update auto-pay setting' });
  }
};

module.exports = {
  // Config
  getPlanConfig,
  getTransactions,
  // Dodo
  createDodoCheckout,
  handleDodoWebhook,
  // Subscriptions (per-sub)
  getSubscriptions,
  cancelSubscription,
  resumeSubscription,
  setAutoPay,
};
