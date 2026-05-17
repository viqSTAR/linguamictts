const prisma = require('../utils/prisma');
const { getMonthKey, addMonthsUtc } = require('../utils/credits');
const dodo = require('../utils/dodo');
const {
  sendPurchaseConfirmation,
  sendRefundConfirmation,
  sendRenewalReceipt,
  sendTopUpConfirmation,
  sendCancellationAck,
} = require('../utils/mailer');

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

// ─── Trial-window refund policy ──────────────────────────────────────────────
// Public policy (see /terms): on the user's first ever paid subscription, if
// they request a refund within 24h of purchase AND have used fewer than
// REFUND_USAGE_CAP credits from that subscription's bucket, we issue an
// automatic full refund and reverse the unused credits.
const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const REFUND_USAGE_CAP = 5000;                // credits drained from this sub

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

      // Same-plan duplicate guard. Users can stack different tiers (STARTER +
      // PRO is fine) but not the same tier twice — that would mean two
      // recurring charges for the same product, which is almost always a
      // mis-click. CANCELED still blocks because the user retains access until
      // their period ends; they can resume that one or wait for it to expire.
      // FAILED / EXPIRED don't block (the previous attempt is dead).
      const existing = await prisma.subscription.findFirst({
        where: {
          userId: user.id,
          planKey,
          status: { in: ['ACTIVE', 'CANCELED', 'ON_HOLD'] },
        },
        select: { id: true, status: true, currentPeriodEnd: true },
      });
      if (existing) {
        return res.status(409).json({
          error: `You already have a ${planKey} subscription${existing.status === 'CANCELED' ? ' (scheduled to end)' : existing.status === 'ON_HOLD' ? ' (on hold — please update your card)' : ''}. Pick a different tier or manage your existing plan.`,
          existingSubscriptionId: existing.id,
          existingStatus: existing.status,
        });
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

    // Top-up receipt — best-effort. Refetch the user to grab the post-grant
    // balance so the email shows the right "new balance" number.
    try {
      const buyer = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, creditsBalance: true },
      });
      if (buyer && buyer.email) {
        await sendTopUpConfirmation({
          to: buyer.email,
          name: buyer.name,
          amountUSD,
          credits,
          newBalance: buyer.creditsBalance,
        });
      }
    } catch (mailErr) {
      console.error('[webhook] top-up email failed (non-fatal):', mailErr.message);
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

    // Marker key is scoped to the specific subscription_id so two simultaneous
    // subscriptions on the same plan don't share a single marker.
    const markerRef = `dodo_sub_${data.subscription_id}_${monthKey}`;
    const existingMarker = await prisma.creditTransaction.findFirst({
      where: { userId, type: 'MONTHLY_RESET', referenceId: markerRef },
      select: { id: true },
    });
    if (existingMarker) return; // replay — already applied

    let wasActivation = false;
    let wasRenewal = false;
    let activationPeriodEnd = null;
    let renewalPeriodEnd = null;
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.subscription.findUnique({
          where: { dodoSubscriptionId: data.subscription_id },
          select: { id: true, creditsRemaining: true, currentPeriodEnd: true },
        });

        // Pick the next period end:
        //   • Always prefer Dodo's next_billing_date when present — that's the
        //     true source of truth and it follows the purchase anniversary.
        //   • Activation fallback: now + 1 month (today as the anniversary).
        //   • Renewal fallback: previous currentPeriodEnd + 1 month, so two
        //     subs bought on day 4 and day 6 stay on their own dates and never
        //     collapse to a shared calendar boundary.
        const fallbackBase = existing ? existing.currentPeriodEnd : new Date();
        const nextPeriodEnd = data.next_billing_date
          ? new Date(data.next_billing_date)
          : addMonthsUtc(fallbackBase, 1);

        let delta;
        if (existing) {
          // Renewal (or replay we already filtered above — defensive). Only
          // fire the renewal-receipt email on the `subscription.renewed`
          // event, not on a duplicate `subscription.active` for the same row
          // (which can happen on edge-case webhook retries).
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
          if (type === 'subscription.renewed') {
            wasRenewal = true;
            renewalPeriodEnd = nextPeriodEnd;
          }
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
          wasActivation = true;
          activationPeriodEnd = nextPeriodEnd;
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

    // Fire the appropriate email — purchase-confirmation on first activation,
    // renewal-receipt on a successful monthly renewal. The daily cron's 3-day
    // reminder is unchanged and runs independently. Both are best-effort: a
    // mail failure here must not retry the whole webhook (credits already
    // granted).
    if (wasActivation || wasRenewal) {
      try {
        const buyer = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });
        if (buyer && buyer.email) {
          if (wasActivation) {
            await sendPurchaseConfirmation({
              to: buyer.email,
              name: buyer.name,
              planKey,
              monthlyCredits: config.monthlyCredits,
              priceUSD: config.priceUSD,
              currentPeriodEnd: activationPeriodEnd,
            });
          } else {
            await sendRenewalReceipt({
              to: buyer.email,
              name: buyer.name,
              planKey,
              monthlyCredits: config.monthlyCredits,
              priceUSD: config.priceUSD,
              currentPeriodEnd: renewalPeriodEnd,
            });
          }
        }
      } catch (mailErr) {
        console.error('[webhook] subscription email failed (non-fatal):', mailErr.message);
      }
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

    try {
      await prisma.$transaction(async (tx) => {
        const sub = await tx.subscription.findUnique({
          where: { dodoSubscriptionId: data.subscription_id },
          select: { id: true, userId: true, creditsRemaining: true, currentPeriodEnd: true },
        });
        if (!sub) return;
        // Anniversary-preserving: roll forward by one month from the prior
        // period end if Dodo didn't supply a fresh next_billing_date.
        const nextPeriodEnd = data.next_billing_date
          ? new Date(data.next_billing_date)
          : addMonthsUtc(sub.currentPeriodEnd, 1);
        const delta = config.monthlyCredits - sub.creditsRemaining;
        await tx.subscription.update({
          where: { id: sub.id },
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

    if (sub.status === 'REFUNDED') {
      return res.status(400).json({ error: 'Subscription was refunded and is no longer active.' });
    }
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

    // Cancellation acknowledgement — best-effort.
    try {
      const buyer = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { email: true, name: true },
      });
      if (buyer && buyer.email) {
        await sendCancellationAck({
          to: buyer.email,
          name: buyer.name,
          planKey: updated.planKey,
          currentPeriodEnd: updated.currentPeriodEnd,
        });
      }
    } catch (mailErr) {
      console.error('[cancel] ack email failed (non-fatal):', mailErr.message);
    }

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
    if (sub.status === 'EXPIRED' || sub.status === 'FAILED' || sub.status === 'REFUNDED') {
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
    if (sub.status === 'EXPIRED' || sub.status === 'FAILED' || sub.status === 'REFUNDED') {
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

    // When the user disables auto-pay we treat it as a cancellation for
    // email-comms purposes — same outcome (plan ends at period end). Re-enable
    // is silent; users who flip it back don't need a confirmation spam.
    if (!enabled) {
      try {
        const buyer = await prisma.user.findUnique({
          where: { id: req.userId },
          select: { email: true, name: true },
        });
        if (buyer && buyer.email) {
          await sendCancellationAck({
            to: buyer.email,
            name: buyer.name,
            planKey: updated.planKey,
            currentPeriodEnd: updated.currentPeriodEnd,
          });
        }
      } catch (mailErr) {
        console.error('[autopay-off] ack email failed (non-fatal):', mailErr.message);
      }
    }

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

// ─── Trial-window refund (24h / <5k credits used) ────────────────────────────
// Eligibility, evaluated authoritatively on the server (the UI mirrors this
// for the button, but we re-check here so a stale UI can't force a refund):
//   1. The subscription belongs to req.userId.
//   2. It's in a refundable state (ACTIVE / CANCELED / ON_HOLD — not already
//      EXPIRED, FAILED, or REFUNDED).
//   3. It is the user's FIRST ever paid subscription (smallest createdAt
//      across all of their subs that have a Dodo subscription id).
//   4. createdAt is within REFUND_WINDOW_MS of now.
//   5. Credits drained from THIS sub's bucket is below REFUND_USAGE_CAP. We
//      use (monthlyCredits - creditsRemaining) so we measure usage that was
//      billed to this specific subscription, not free-tier or addon usage.
const evaluateRefundEligibility = async (userId, subscription) => {
  const reasons = [];

  if (!subscription) {
    return { eligible: false, reasons: ['Subscription not found'] };
  }
  if (subscription.userId !== userId) {
    return { eligible: false, reasons: ['Subscription does not belong to this user'] };
  }

  const refundableStates = new Set(['ACTIVE', 'CANCELED', 'ON_HOLD']);
  if (!refundableStates.has(subscription.status)) {
    reasons.push(`Subscription is in ${subscription.status} state and cannot be refunded`);
  }

  // First paid subscription: smallest createdAt among the user's subs that
  // ever made it to Dodo (so failed pre-checkout placeholders don't count).
  const firstPaidSub = await prisma.subscription.findFirst({
    where: {
      userId,
      dodoSubscriptionId: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true },
  });
  if (!firstPaidSub || firstPaidSub.id !== subscription.id) {
    reasons.push('Trial-window refund applies only to your first paid subscription');
  }

  const ageMs = Date.now() - new Date(subscription.createdAt).getTime();
  if (ageMs > REFUND_WINDOW_MS) {
    reasons.push('Trial-window refund expires 24 hours after purchase');
  }

  const usedFromThisSub = Math.max(0, subscription.monthlyCredits - subscription.creditsRemaining);
  if (usedFromThisSub >= REFUND_USAGE_CAP) {
    reasons.push(`You have used ${usedFromThisSub.toLocaleString()} credits from this plan — refund requires fewer than ${REFUND_USAGE_CAP.toLocaleString()}`);
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    ageMs,
    usedFromThisSub,
    windowMs: REFUND_WINDOW_MS,
    usageCap: REFUND_USAGE_CAP,
  };
};

// GET /billing/subscriptions/:subscriptionId/refund-eligibility
// Lightweight read used by the frontend to decide whether to render the
// "Request refund" button. Returns the same fields the POST handler uses to
// authorize, so the UI can show a precise reason when it's not eligible.
const getRefundEligibility = async (req, res) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.subscriptionId },
      select: {
        id: true, userId: true, status: true, createdAt: true,
        monthlyCredits: true, creditsRemaining: true, dodoSubscriptionId: true,
        planKey: true,
      },
    });
    if (!sub || sub.userId !== req.userId) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    const ev = await evaluateRefundEligibility(req.userId, sub);
    res.json({
      eligible: ev.eligible,
      reasons: ev.reasons,
      ageMs: ev.ageMs,
      usedFromThisSub: ev.usedFromThisSub,
      windowMs: ev.windowMs,
      usageCap: ev.usageCap,
    });
  } catch (error) {
    console.error('getRefundEligibility error:', error);
    res.status(500).json({ error: 'Failed to evaluate refund eligibility' });
  }
};

// POST /billing/subscriptions/:subscriptionId/refund
//
// Atomic refund flow:
//   1. Re-check eligibility on the server (UI is advisory).
//   2. Look up the activation payment_id from Dodo.
//   3. Cancel the Dodo subscription immediately (cancel_at_next_billing_date=true)
//      so it never renews. We can't *terminate* a Dodo sub mid-period, but the
//      refund itself reverses the only charge that was made.
//   4. Issue the refund through Dodo.
//   5. In a DB transaction: mark our subscription REFUNDED, zero its credit
//      bucket, decrement the user's cached creditsBalance by whatever was left,
//      and log a CreditTransaction.
//
// Ordering note: we do the Dodo refund BEFORE mutating local state so a failed
// refund doesn't leave the user with no credits AND no money back. If the DB
// mutation later fails after a successful refund, the user keeps both their
// money and (briefly) their credits — strictly user-favouring drift that the
// next webhook (subscription.cancelled) and/or a manual reconcile can clean up.
const refundSubscription = async (req, res) => {
  try {
    if (!dodo.isEnabled()) {
      return res.status(503).json({ error: 'Refunds are not currently available — please contact support.' });
    }

    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.subscriptionId },
      select: {
        id: true, userId: true, status: true, createdAt: true,
        monthlyCredits: true, creditsRemaining: true, dodoSubscriptionId: true,
        planKey: true,
      },
    });
    if (!sub || sub.userId !== req.userId) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const ev = await evaluateRefundEligibility(req.userId, sub);
    if (!ev.eligible) {
      return res.status(400).json({
        error: ev.reasons[0] || 'Not eligible for automated refund',
        reasons: ev.reasons,
      });
    }

    if (!sub.dodoSubscriptionId) {
      return res.status(400).json({ error: 'Subscription is missing a payment-provider reference' });
    }

    // Find the activation payment so we can refund it.
    let paymentId;
    try {
      paymentId = await dodo.findActivationPaymentId(sub.dodoSubscriptionId);
    } catch (err) {
      console.error('Refund: failed to look up activation payment:', err.message);
      return res.status(502).json({ error: 'Could not reach payment provider to locate original charge' });
    }
    if (!paymentId) {
      return res.status(502).json({ error: 'Could not find the original charge for this subscription' });
    }

    // Schedule cancellation in Dodo (so it doesn't auto-renew tomorrow). We
    // tolerate "already cancelled" by reconciling — same shape as the regular
    // cancel handler.
    try {
      await dodo.cancelDodoSubscription(sub.dodoSubscriptionId, { reason: 'refund-issued' });
    } catch (err) {
      let reconciled = false;
      try {
        const live = await dodo.getDodoSubscription(sub.dodoSubscriptionId);
        if (live && (live.cancel_at_next_billing_date === true
          || live.status === 'cancelled'
          || live.status === 'expired')) {
          reconciled = true;
        }
      } catch (_) { /* ignore */ }
      if (!reconciled) {
        console.error('Refund: Dodo cancel failed:', err.message);
        return res.status(502).json({ error: 'Failed to cancel subscription with payment provider' });
      }
    }

    // Issue the refund. If this throws we abort BEFORE mutating local state.
    let refundResult;
    try {
      refundResult = await dodo.refundPayment(paymentId, {
        reason: `Trial-window refund: ${ev.usedFromThisSub} credits used in first ${Math.round(ev.ageMs / 3600000)}h`,
      });
    } catch (err) {
      console.error('Refund: Dodo refund failed:', err.message);
      return res.status(502).json({ error: 'Refund could not be processed by payment provider' });
    }

    // Local state mutation. The refund has already been issued; if this step
    // fails the next webhook will likely reconcile, but we still surface the
    // error so it gets logged.
    try {
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.subscription.findUnique({
          where: { id: sub.id },
          select: { creditsRemaining: true, status: true },
        });
        const refundCreditsAmount = fresh ? fresh.creditsRemaining : 0;

        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'REFUNDED',
            autoRenew: false,
            creditsRemaining: 0,
            canceledAt: new Date(),
          },
        });

        if (refundCreditsAmount > 0) {
          await tx.user.update({
            where: { id: sub.userId },
            data: { creditsBalance: { decrement: refundCreditsAmount } },
          });
        }

        await tx.creditTransaction.create({
          data: {
            userId: sub.userId,
            amount: -refundCreditsAmount,
            type: 'REFUND',
            description: `Trial-window refund: ${sub.planKey} plan — Dodo refund ${refundResult.refund_id || ''}`,
            referenceId: refundResult.refund_id || paymentId,
          },
        });
      });
    } catch (err) {
      console.error('Refund: local state update failed AFTER successful Dodo refund:', err);
      return res.status(500).json({
        error: 'Refund issued but local account update failed — please contact support with this id',
        refundId: refundResult.refund_id,
      });
    }

    // Best-effort refund email. The refund itself has already succeeded by
    // this point — a mail failure must not turn that into a 500.
    try {
      const buyer = await prisma.user.findUnique({
        where: { id: sub.userId },
        select: { email: true, name: true },
      });
      if (buyer && buyer.email) {
        const priceUSD = PLAN_CONFIG[sub.planKey] ? PLAN_CONFIG[sub.planKey].priceUSD : null;
        await sendRefundConfirmation({
          to: buyer.email,
          name: buyer.name,
          planKey: sub.planKey,
          priceUSD,
          refundId: refundResult.refund_id,
        });
      }
    } catch (mailErr) {
      console.error('[refund] confirmation email failed (non-fatal):', mailErr.message);
    }

    res.json({
      message: 'Refund issued. It typically settles in 5–10 business days.',
      refundId: refundResult.refund_id,
      status: refundResult.status,
    });
  } catch (error) {
    console.error('refundSubscription error:', error);
    res.status(500).json({ error: 'Failed to process refund' });
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
  // Trial-window refund
  getRefundEligibility,
  refundSubscription,
};
