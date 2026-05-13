const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const prisma = require('../utils/prisma');
const { getMonthKey, endOfCurrentMonthUtc } = require('../utils/credits');
const dodo = require('../utils/dodo');

// NOTE on credit rates:
// Single source of truth for credit grants is TOPUP_CONFIG (top-ups) and
// PLAN_CONFIG (subscriptions). The Stripe verifyPayment branch is dormant
// and kept only until the Stripe dep is removed in the cleanup pass.
// Dodo top-up credits are granted in the webhook handler, not here.
const PLAN_RANK = { FREE: 0, STARTER: 1, CREATOR: 2, PRO: 3 };

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

// ─── Stripe: Create Payment Intent (dormant; kept for future) ────────────────
const createPaymentIntent = async (req, res) => {
  try {
    const { amountUSD } = req.body;
    if (!Number.isFinite(amountUSD) || amountUSD < 1 || amountUSD > MAX_TOPUP_USD) {
      return res.status(400).json({ error: `Amount must be between $1 and $${MAX_TOPUP_USD}` });
    }
    const amountInCents = Math.round(amountUSD * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: { userId: req.userId },
    });
    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (error) {
    console.error('Stripe Create Order Error:', error);
    res.status(500).json({ error: 'Failed to create Stripe payment intent', details: error.message });
  }
};

// ─── Stripe: Verify Payment (dormant; kept for future) ───────────────────────
const verifyPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment Intent ID is required' });
    }
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!paymentIntent.metadata || paymentIntent.metadata.userId !== req.userId) {
      return res.status(403).json({ error: 'Payment intent does not belong to this user' });
    }
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: `Payment status is ${paymentIntent.status}, not succeeded` });
    }

    // Match dummy rate: same TOPUP_CONFIG formula in both branches.
    const amountUSD = paymentIntent.amount / 100;
    const creditsToStore = getTopUpCredits(amountUSD);

    try {
      const updatedUser = await prisma.$transaction(async (tx) => {
        await tx.creditTransaction.create({
          data: {
            userId: req.userId,
            amount: creditsToStore,
            type: 'ADDON_TOPUP',
            description: `Stripe add-on top-up of $${amountUSD.toFixed(2)} — ${creditsToStore.toLocaleString()} permanent credits`,
            referenceId: paymentIntentId,
          },
        });
        return await tx.user.update({
          where: { id: req.userId },
          data: {
            creditsBalance: { increment: creditsToStore },
            addonCredits: { increment: creditsToStore },
          },
        });
      });
      return res.json({
        message: 'Payment verified and permanent credits added',
        newBalance: updatedUser.creditsBalance,
        addonCredits: updatedUser.addonCredits,
      });
    } catch (txErr) {
      if (isDuplicateTxn(txErr)) {
        return res.status(409).json({ error: 'Payment already processed' });
      }
      throw txErr;
    }
  } catch (error) {
    console.error('Stripe Verify Error:', error);
    res.status(500).json({ error: 'Failed to verify Stripe payment' });
  }
};

// ─── Dummy Add-on Top-Up (active until Dodo Payment integration) ─────────────
const dummyTopUp = async (req, res) => {
  try {
    const { amountUSD } = req.body;
    if (!Number.isFinite(amountUSD) || amountUSD < 1 || amountUSD > MAX_TOPUP_USD) {
      return res.status(400).json({ error: `Amount must be between $1 and $${MAX_TOPUP_USD}` });
    }
    const creditsToStore = getTopUpCredits(amountUSD);
    const dummyTransactionId = `dummy_addon_${req.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      const updatedUser = await prisma.$transaction(async (tx) => {
        await tx.creditTransaction.create({
          data: {
            userId: req.userId,
            amount: creditsToStore,
            type: 'ADDON_TOPUP',
            description: `Add-on pack of $${amountUSD} — ${creditsToStore.toLocaleString()} permanent credits`,
            referenceId: dummyTransactionId,
          },
        });
        return await tx.user.update({
          where: { id: req.userId },
          data: {
            creditsBalance: { increment: creditsToStore },
            addonCredits: { increment: creditsToStore },
          },
        });
      });

      return res.json({
        message: 'Add-on credits added permanently to your account',
        newBalance: updatedUser.creditsBalance,
        addonCredits: updatedUser.addonCredits,
        creditsAdded: creditsToStore,
      });
    } catch (txErr) {
      if (isDuplicateTxn(txErr)) {
        return res.status(409).json({ error: 'Duplicate top-up request' });
      }
      throw txErr;
    }
  } catch (error) {
    console.error('Dummy TopUp Error:', error);
    res.status(500).json({ error: 'Failed to process top-up' });
  }
};

// ─── Plan Upgrade ────────────────────────────────────────────────────────────
const upgradePlan = async (req, res) => {
  try {
    const { plan } = req.body;
    const planKey = (plan || '').toUpperCase();

    if (!PLAN_CONFIG[planKey]) {
      return res.status(400).json({ error: 'Invalid plan. Must be STARTER, CREATOR, or PRO.' });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { plan: true, creditsBalance: true, planMonthlyCredits: true, addonCredits: true },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentRank = PLAN_RANK[currentUser.plan] ?? 0;
    const newRank = PLAN_RANK[planKey] ?? 0;

    if (newRank <= currentRank) {
      return res.status(400).json({
        error: `Cannot downgrade or stay on the same plan. You are currently on ${currentUser.plan}. Choose a higher plan.`,
        currentPlan: currentUser.plan,
      });
    }

    const config = PLAN_CONFIG[planKey];

    const currentAddonCredits = currentUser.addonCredits ?? 0;
    const currentPlanBalance = Math.max(0, currentUser.creditsBalance - currentAddonCredits);
    const newBalance = config.monthlyCredits + currentPlanBalance + currentAddonCredits;
    const carryOver = currentPlanBalance;

    const referenceId = `plan_${planKey}_${req.userId}_${Date.now()}`;

    try {
      const updatedUser = await prisma.$transaction(async (tx) => {
        // CRITICAL: do NOT delete the current month's MONTHLY_RESET row.
        // Deleting it causes ensureMonthlyCredits to re-fire on the very next
        // authenticated request, which overwrites creditsBalance back to
        // (planMonthlyCredits + addonCredits) — wiping the carry-over we just
        // credited below. The MONTHLY_RESET row stays as a marker that the
        // month was already reset; the new tier naturally applies next month.

        const user = await tx.user.update({
          where: { id: req.userId },
          data: {
            plan: planKey,
            planMonthlyCredits: config.monthlyCredits,
            planStartedAt: new Date(),
            creditsBalance: newBalance,
            // Activate subscription — auto-renews until user cancels.
            subscriptionStatus: 'ACTIVE',
            autoRenew: true,
            currentPeriodEnd: endOfCurrentMonthUtc(),
            canceledAt: null,
          },
        });

        await tx.creditTransaction.create({
          data: {
            userId: req.userId,
            amount: config.monthlyCredits,
            type: 'PLAN_UPGRADE',
            description: `Upgraded to ${planKey} — ${config.monthlyCredits.toLocaleString()} credits granted + ${carryOver.toLocaleString()} carried over from previous plan`,
            referenceId,
          },
        });

        return user;
      });

      return res.json({
        message: `Successfully upgraded to ${planKey} plan`,
        plan: updatedUser.plan,
        newBalance: updatedUser.creditsBalance,
        planMonthlyCredits: updatedUser.planMonthlyCredits,
        carryOverCredits: carryOver,
        addonCredits: updatedUser.addonCredits,
      });
    } catch (txErr) {
      if (isDuplicateTxn(txErr)) {
        return res.status(409).json({ error: 'Duplicate upgrade request' });
      }
      throw txErr;
    }
  } catch (error) {
    console.error('Plan Upgrade Error:', error);
    res.status(500).json({ error: 'Failed to upgrade plan', details: error.message });
  }
};

const getPlanConfig = (req, res) => {
  res.json({
    plans: PLAN_CONFIG,
    planRank: PLAN_RANK,
    topups: TOPUP_CONFIG,
    dodoEnabled: dodo.isEnabled(),
  });
};

// ─── Dodo Payments: checkout session creation ────────────────────────────────
// Creates a Dodo hosted checkout session and returns its URL. The frontend
// redirects to (or overlays) this URL. Credits are NOT granted here — the
// webhook handler is the only path that can grant credits, so a hijacked
// frontend can't manufacture money.
//
// One endpoint, two modes (kind: 'topup' | 'plan') — keeps the routing flat.
const createDodoCheckout = async (req, res) => {
  try {
    if (!dodo.isEnabled()) {
      return res.status(503).json({ error: 'Dodo Payments is not enabled' });
    }

    const { kind, amountUSD, plan } = req.body || {};

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, plan: true, dodoCustomerId: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (kind === 'topup') {
      if (!Number.isFinite(amountUSD) || amountUSD < 1 || amountUSD > MAX_TOPUP_USD) {
        return res.status(400).json({ error: `Amount must be between $1 and $${MAX_TOPUP_USD}` });
      }
      // We only have Dodo products configured for the standard $1/$5/$10 tiers.
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
      const currentRank = PLAN_RANK[user.plan] ?? 0;
      const newRank = PLAN_RANK[planKey] ?? 0;
      if (newRank <= currentRank) {
        return res.status(400).json({
          error: `Cannot downgrade or stay on the same plan. You are currently on ${user.plan}.`,
          currentPlan: user.plan,
        });
      }

      // Existing-subscription guard: creating a brand-new checkout while the
      // user has an active Dodo subscription would leave two active subs
      // (and two recurring charges). Until changePlan is wired up, we refuse
      // and tell the user to cancel first. FREE → paid path is unaffected.
      if (user.dodoSubscriptionId) {
        return res.status(409).json({
          error: 'You already have an active subscription. Please cancel it before upgrading to a different plan.',
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
// Idempotency: every credit-granting branch creates a CreditTransaction with
// a deterministic referenceId. The (userId, type, referenceId) unique index
// makes duplicate webhooks safe — Postgres rejects the insert with P2002 and
// we treat that as "already processed".
const handleDodoWebhook = async (req, res) => {
  if (!dodo.isEnabled()) {
    // Don't 200 here — if the webhook fires while disabled, something is
    // misconfigured and we want Dodo to retry once env is set.
    return res.status(503).json({ error: 'Dodo Payments is not enabled' });
  }

  // req.body is a Buffer (from express.raw). Convert to string for the SDK.
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');

  let event;
  try {
    event = dodo.verifyWebhook(rawBody, req.headers);
  } catch (err) {
    console.error('Dodo webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  // Always 200 once verified — we record what we can. Throwing here causes
  // Dodo to retry, which is fine for transient DB errors but noisy for
  // events we deliberately ignore.
  try {
    await processDodoEvent(event);
  } catch (err) {
    // Real failure (DB down, etc.) — return 500 so Dodo retries.
    console.error('Dodo webhook processing error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  res.json({ received: true });
};

// Extract our internal userId from a webhook event's data.metadata.
// Falls back to looking up the user by dodoSubscriptionId for subscription
// renewal/cancellation events where metadata might not survive (it should,
// but defensive — and renewals are months apart, lots of room for drift).
const resolveUserIdFromEvent = async (data) => {
  const fromMetadata = data && data.metadata && data.metadata.userId;
  if (fromMetadata) return fromMetadata;

  if (data && data.subscription_id) {
    const user = await prisma.user.findUnique({
      where: { dodoSubscriptionId: data.subscription_id },
      select: { id: true },
    });
    if (user) return user.id;
  }
  return null;
};

const processDodoEvent = async (event) => {
  const { type, data } = event || {};
  if (!type || !data) return;

  // ── One-time payment (top-up) ──────────────────────────────────────────────
  // Subscription payments also fire payment.succeeded — we distinguish by
  // presence of subscription_id. Subscriptions are credited via
  // subscription.active / .renewed below, so skip them here.
  if (type === 'payment.succeeded') {
    if (data.subscription_id) return; // handled by subscription events
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
            // Persist the Dodo customer id so future checkouts can reuse
            // saved payment methods on the same customer record.
            ...(data.customer && data.customer.customer_id
              ? { dodoCustomerId: data.customer.customer_id }
              : {}),
          },
        });
      });
    } catch (err) {
      if (isDuplicateTxn(err)) return; // replay — already credited
      throw err;
    }
    return;
  }

  // ── Subscription activated (first payment) ────────────────────────────────
  if (type === 'subscription.active' || type === 'subscription.renewed') {
    const userId = await resolveUserIdFromEvent(data);
    if (!userId) {
      console.error(`${type} without resolvable userId, subscription_id:`, data.subscription_id);
      return;
    }

    const planKey = (data.metadata && data.metadata.planKey)
      || (data.product_id ? require('../utils/dodo').lookupPlanByProductId(data.product_id) : null);
    if (!planKey || !PLAN_CONFIG[planKey]) {
      console.error(`${type} for unknown plan, subscription_id:`, data.subscription_id, 'product_id:', data.product_id);
      return;
    }

    const config = PLAN_CONFIG[planKey];

    // For initial activation: stamp the subscription_id on the user, set plan,
    //   and grant credits (preserving any addon carry-over). Mirrors the old
    //   upgradePlan flow.
    // For renewal: re-grant monthly credits, push currentPeriodEnd, and
    //   create a MONTHLY_RESET row so ensureMonthlyCredits doesn't double-fire.
    const isActivation = type === 'subscription.active';
    const monthKey = getMonthKey(new Date());
    const referenceId = isActivation
      ? `dodo_sub_active_${data.subscription_id}`
      : `MONTHLY_RESET_${monthKey}_${data.subscription_id}`;
    const txType = isActivation ? 'PLAN_UPGRADE' : 'MONTHLY_RESET';
    const nextPeriodEnd = data.next_billing_date ? new Date(data.next_billing_date) : endOfCurrentMonthUtc();

    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { creditsBalance: true, addonCredits: true, plan: true },
        });
        if (!user) return;

        const addonCredits = user.addonCredits ?? 0;
        const currentPlanBalance = Math.max(0, user.creditsBalance - addonCredits);
        // On renewal, plan credits do not carry over (matches local logic).
        // On activation, plan credits from the prior plan DO carry over.
        const carryOver = isActivation ? currentPlanBalance : 0;
        const newBalance = config.monthlyCredits + carryOver + addonCredits;
        const delta = newBalance - user.creditsBalance;

        await tx.creditTransaction.create({
          data: {
            userId,
            amount: isActivation ? config.monthlyCredits : delta,
            type: txType,
            description: isActivation
              ? `Dodo: upgraded to ${planKey} — ${config.monthlyCredits.toLocaleString()} credits + ${carryOver.toLocaleString()} carried over`
              : `Dodo: ${planKey} renewed for ${monthKey} — ${config.monthlyCredits.toLocaleString()} plan credits + ${addonCredits.toLocaleString()} permanent add-ons`,
            referenceId,
          },
        });

        // ALSO insert a MONTHLY_RESET marker (renewal only) so the next call
        // to ensureMonthlyCredits sees this month as processed.
        if (!isActivation) {
          try {
            await tx.creditTransaction.create({
              data: {
                userId,
                amount: 0,
                type: 'MONTHLY_RESET',
                description: `Dodo renewal marker for ${monthKey}`,
                referenceId: monthKey,
              },
            });
          } catch (e) { if (!isDuplicateTxn(e)) throw e; }
        }

        await tx.user.update({
          where: { id: userId },
          data: {
            plan: planKey,
            planMonthlyCredits: config.monthlyCredits,
            planStartedAt: isActivation ? new Date() : undefined,
            creditsBalance: newBalance,
            subscriptionStatus: 'ACTIVE',
            autoRenew: true,
            currentPeriodEnd: nextPeriodEnd,
            canceledAt: null,
            dodoSubscriptionId: data.subscription_id,
            ...(data.customer && data.customer.customer_id
              ? { dodoCustomerId: data.customer.customer_id }
              : {}),
          },
        });
      });
    } catch (err) {
      if (isDuplicateTxn(err)) return; // replay
      throw err;
    }
    return;
  }

  // ── Subscription cancelled (will lapse at period end, or already expired) ──
  if (type === 'subscription.cancelled') {
    const userId = await resolveUserIdFromEvent(data);
    if (!userId) return;

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'CANCELED',
        autoRenew: false,
        canceledAt: data.cancelled_at ? new Date(data.cancelled_at) : new Date(),
      },
    }).catch(err => console.error('subscription.cancelled DB update failed:', err.message));
    return;
  }

  // ── Subscription expired — downgrade to FREE ──────────────────────────────
  if (type === 'subscription.expired') {
    const userId = await resolveUserIdFromEvent(data);
    if (!userId) return;

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'FREE',
        planMonthlyCredits: 10000,
        subscriptionStatus: 'NONE',
        autoRenew: false,
        currentPeriodEnd: null,
        dodoSubscriptionId: null,
      },
    }).catch(err => console.error('subscription.expired DB update failed:', err.message));
    return;
  }

  // ── Payment failed — surface for ops, no credit change ─────────────────────
  if (type === 'payment.failed' || type === 'subscription.failed') {
    console.warn(`Dodo ${type}:`, data.payment_id || data.subscription_id, data.error_message || '');
    return;
  }

  // Other events (disputes, refunds, credit_* internal Dodo events, etc.)
  // are intentionally ignored — add handlers as the feature set grows.
};

// ─── Subscription: cancel / resume / status ──────────────────────────────────
// All three reject FREE users since FREE has no subscription to manage.

const getSubscription = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        autoRenew: true,
        canceledAt: true,
        planMonthlyCredits: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      plan: user.plan,
      status: user.subscriptionStatus,
      autoRenew: user.autoRenew,
      currentPeriodEnd: user.currentPeriodEnd,
      canceledAt: user.canceledAt,
      planMonthlyCredits: user.planMonthlyCredits,
      // Convenience flag for UI gating — FREE plans cannot manage subs.
      manageable: user.plan !== 'FREE',
    });
  } catch (error) {
    console.error('getSubscription error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
};

const cancelSubscription = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        plan: true, subscriptionStatus: true, autoRenew: true,
        currentPeriodEnd: true, dodoSubscriptionId: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.plan === 'FREE') {
      return res.status(400).json({ error: 'FREE plan has no subscription to cancel.' });
    }
    if (user.subscriptionStatus === 'CANCELED' || user.autoRenew === false) {
      return res.status(400).json({
        error: 'Subscription is already cancelled.',
        currentPeriodEnd: user.currentPeriodEnd,
      });
    }

    // If Dodo is active and we have an external subscription_id, cancel it
    // there first. Local DB update is still authoritative for UI, but Dodo
    // must stop billing — otherwise the user gets charged again next cycle.
    if (dodo.isEnabled() && user.dodoSubscriptionId) {
      try {
        await dodo.cancelDodoSubscription(user.dodoSubscriptionId, { reason: 'user-initiated' });
      } catch (err) {
        console.error('Dodo cancel API failed:', err.message);
        return res.status(502).json({ error: 'Failed to cancel subscription with payment provider' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        subscriptionStatus: 'CANCELED',
        autoRenew: false,
        canceledAt: new Date(),
      },
      select: {
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        autoRenew: true,
        canceledAt: true,
      },
    });

    res.json({
      message: 'Subscription cancelled. You keep access until the end of your billing period.',
      ...updated,
    });
  } catch (error) {
    console.error('cancelSubscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

const resumeSubscription = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        plan: true, subscriptionStatus: true, autoRenew: true,
        currentPeriodEnd: true, dodoSubscriptionId: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.plan === 'FREE') {
      return res.status(400).json({ error: 'FREE plan has no subscription to resume.' });
    }
    // If the period already expired, the user has effectively been downgraded
    // (next request to ensureMonthlyCredits will resolve that). They need to
    // pay/upgrade again, not "resume".
    if (user.currentPeriodEnd && user.currentPeriodEnd <= new Date()) {
      return res.status(400).json({ error: 'Billing period has ended. Please upgrade again.' });
    }
    if (user.subscriptionStatus === 'ACTIVE' && user.autoRenew) {
      return res.status(400).json({ error: 'Subscription is already active.' });
    }

    if (dodo.isEnabled() && user.dodoSubscriptionId) {
      try {
        await dodo.resumeDodoSubscription(user.dodoSubscriptionId);
      } catch (err) {
        console.error('Dodo resume API failed:', err.message);
        return res.status(502).json({ error: 'Failed to resume subscription with payment provider' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        subscriptionStatus: 'ACTIVE',
        autoRenew: true,
        canceledAt: null,
      },
      select: {
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        autoRenew: true,
        canceledAt: true,
      },
    });

    res.json({
      message: 'Subscription resumed. Auto-pay is on.',
      ...updated,
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

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        plan: true, subscriptionStatus: true, autoRenew: true,
        currentPeriodEnd: true, dodoSubscriptionId: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.plan === 'FREE') {
      return res.status(400).json({ error: 'Auto-pay is only available on paid plans.' });
    }
    if (user.currentPeriodEnd && user.currentPeriodEnd <= new Date()) {
      return res.status(400).json({ error: 'Billing period has ended. Please upgrade again.' });
    }

    // Auto-pay toggle = enable/disable the scheduled cancellation in Dodo.
    // Disabling auto-pay is the same operation as cancelling (cancel at end
    // of period); enabling it = un-schedule the cancellation.
    if (dodo.isEnabled() && user.dodoSubscriptionId) {
      try {
        if (enabled) {
          await dodo.resumeDodoSubscription(user.dodoSubscriptionId);
        } else {
          await dodo.cancelDodoSubscription(user.dodoSubscriptionId, { reason: 'auto-pay-disabled' });
        }
      } catch (err) {
        console.error('Dodo auto-pay toggle failed:', err.message);
        return res.status(502).json({ error: 'Failed to update auto-pay with payment provider' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        autoRenew: enabled,
        subscriptionStatus: enabled ? 'ACTIVE' : 'CANCELED',
        canceledAt: enabled ? null : new Date(),
      },
      select: {
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        autoRenew: true,
        canceledAt: true,
      },
    });

    res.json({
      message: enabled ? 'Auto-pay enabled.' : 'Auto-pay disabled. Plan ends at period end.',
      ...updated,
    });
  } catch (error) {
    console.error('setAutoPay error:', error);
    res.status(500).json({ error: 'Failed to update auto-pay setting' });
  }
};

module.exports = {
  createPaymentIntent,
  verifyPayment,
  dummyTopUp,
  upgradePlan,
  getPlanConfig,
  getTransactions,
  getSubscription,
  cancelSubscription,
  resumeSubscription,
  setAutoPay,
  // Dodo
  createDodoCheckout,
  handleDodoWebhook,
};
