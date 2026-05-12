const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const prisma = require('../utils/prisma');
const { getMonthKey, endOfCurrentMonthUtc } = require('../utils/credits');

// NOTE on credit rates:
// The dummy/Dodo (future) top-up path is the authoritative source of credits.
// The Stripe verifyPayment branch below is dormant — Stripe will be replaced
// by Dodo. Both paths now share TOPUP_CONFIG so the credit rate is identical.
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
  res.json({ plans: PLAN_CONFIG, planRank: PLAN_RANK, topups: TOPUP_CONFIG });
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
      select: { plan: true, subscriptionStatus: true, autoRenew: true, currentPeriodEnd: true },
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
      select: { plan: true, subscriptionStatus: true, autoRenew: true, currentPeriodEnd: true },
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
      select: { plan: true, subscriptionStatus: true, autoRenew: true, currentPeriodEnd: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.plan === 'FREE') {
      return res.status(400).json({ error: 'Auto-pay is only available on paid plans.' });
    }
    if (user.currentPeriodEnd && user.currentPeriodEnd <= new Date()) {
      return res.status(400).json({ error: 'Billing period has ended. Please upgrade again.' });
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
};
