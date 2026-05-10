const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const prisma = require('../utils/prisma');
const { getMonthKey } = require('../utils/credits');

// Stripe: $1 = 100 cents = 10,000 credits → 1 cent = 100 credits
const CREDITS_PER_CENT = 100;

// Plan hierarchy — higher number = higher plan (used for upgrade enforcement)
const PLAN_RANK = { FREE: 0, STARTER: 1, CREATOR: 2, PRO: 3 };

// Canonical plan definitions — single source of truth
const PLAN_CONFIG = {
  STARTER: { monthlyCredits: 45000,  priceUSD: 4.99  },
  CREATOR: { monthlyCredits: 210000, priceUSD: 18.99 },
  PRO:     { monthlyCredits: 850000, priceUSD: 79.99 },
};

// Add-on top-up credit tiers
const TOPUP_CONFIG = [
  { amountUSD: 1,  credits: 5000  },
  { amountUSD: 5,  credits: 25000 },
  { amountUSD: 10, credits: 55000 },
];

const getTopUpCredits = (amountUSD) => {
  const tier = TOPUP_CONFIG.find(t => t.amountUSD === amountUSD);
  return tier ? tier.credits : Math.round(amountUSD * 5000);
};

// ─── Transaction History (credits) ─────────────────────────────────────────
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

// ─── Stripe: Create Payment Intent ────────────────────────────────────────────
const createPaymentIntent = async (req, res) => {
  try {
    const { amountUSD } = req.body;
    if (!amountUSD || amountUSD < 1) {
      return res.status(400).json({ error: 'Minimum amount is $1' });
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

// ─── Stripe: Verify Payment (used for add-on top-ups via Stripe) ─────────────
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
    const existingTransaction = await prisma.creditTransaction.findFirst({
      where: { referenceId: paymentIntentId },
    });
    if (existingTransaction) {
      return res.status(400).json({ error: 'Payment already processed' });
    }
    const amountInCents = paymentIntent.amount;
    const creditsToStore = amountInCents * CREDITS_PER_CENT;

    // Add-on credits: permanently tracked in addonCredits + added to balance
    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.creditTransaction.create({
        data: {
          userId: req.userId,
          amount: creditsToStore,
          type: 'ADDON_TOPUP',
          description: `Stripe add-on top-up of $${(amountInCents / 100).toFixed(2)} — ${creditsToStore.toLocaleString()} permanent credits`,
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
    res.json({ message: 'Payment verified and permanent credits added', newBalance: updatedUser.creditsBalance, addonCredits: updatedUser.addonCredits });
  } catch (error) {
    console.error('Stripe Verify Error:', error);
    res.status(500).json({ error: 'Failed to verify Stripe payment' });
  }
};

// ─── Dummy Add-on Top-Up (Permanent credits, never reset) ────────────────────
const dummyTopUp = async (req, res) => {
  try {
    const { amountUSD } = req.body;
    if (!amountUSD || amountUSD < 1) {
      return res.status(400).json({ error: 'Minimum amount is $1' });
    }
    const creditsToStore = getTopUpCredits(amountUSD);
    const dummyTransactionId = `dummy_addon_${Date.now()}`;

    // Add-on credits are PERMANENT — tracked in addonCredits, added to balance
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

    res.json({
      message: 'Add-on credits added permanently to your account',
      newBalance: updatedUser.creditsBalance,
      addonCredits: updatedUser.addonCredits,
      creditsAdded: creditsToStore,
    });
  } catch (error) {
    console.error('Dummy TopUp Error:', error);
    res.status(500).json({ error: 'Failed to process top-up' });
  }
};

// ─── Plan Upgrade (upgrade-only, carries over remaining credits) ──────────────
const upgradePlan = async (req, res) => {
  try {
    const { plan } = req.body;
    const planKey = (plan || '').toUpperCase();

    if (!PLAN_CONFIG[planKey]) {
      return res.status(400).json({ error: 'Invalid plan. Must be STARTER, CREATOR, or PRO.' });
    }

    // Fetch current user
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { plan: true, creditsBalance: true, planMonthlyCredits: true, addonCredits: true },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // ── ENFORCE UPGRADE-ONLY ──────────────────────────────────────────────────
    const currentRank = PLAN_RANK[currentUser.plan] ?? 0;
    const newRank = PLAN_RANK[planKey] ?? 0;

    if (newRank <= currentRank) {
      return res.status(400).json({
        error: `Cannot downgrade or stay on the same plan. You are currently on ${currentUser.plan}. Choose a higher plan.`,
        currentPlan: currentUser.plan,
      });
    }

    const config = PLAN_CONFIG[planKey];
    const monthKey = getMonthKey(new Date());

    // ── CARRY-OVER CALCULATION ────────────────────────────────────────────────
    // Remaining plan credits = total balance − addon credits (plan credits only)
    // Carry over remaining plan credits + full new plan allocation
    const currentAddonCredits = currentUser.addonCredits ?? 0;
    const currentPlanBalance = Math.max(0, currentUser.creditsBalance - currentAddonCredits);
    
    // New balance = new plan allocation + remaining old plan credits + addon credits
    const newBalance = config.monthlyCredits + currentPlanBalance + currentAddonCredits;
    const carryOver = currentPlanBalance;

    const updatedUser = await prisma.$transaction(async (tx) => {
      // Remove this month's MONTHLY_RESET so the new tier applies cleanly at next reset
      await tx.creditTransaction.deleteMany({
        where: { userId: req.userId, type: 'MONTHLY_RESET', referenceId: monthKey },
      });

      // Set new plan and new balance (with carry-over)
      const user = await tx.user.update({
        where: { id: req.userId },
        data: {
          plan: planKey,
          planMonthlyCredits: config.monthlyCredits,
          planStartedAt: new Date(),
          creditsBalance: newBalance,
          // addonCredits is NOT changed — it stays permanent
        },
      });

      // Audit: plan upgrade entry
      await tx.creditTransaction.create({
        data: {
          userId: req.userId,
          amount: config.monthlyCredits,
          type: 'PLAN_UPGRADE',
          description: `Upgraded to ${planKey} — ${config.monthlyCredits.toLocaleString()} credits granted + ${carryOver.toLocaleString()} carried over from previous plan`,
          referenceId: `plan_${planKey}_${Date.now()}`,
        },
      });

      return user;
    });

    res.json({
      message: `Successfully upgraded to ${planKey} plan`,
      plan: updatedUser.plan,
      newBalance: updatedUser.creditsBalance,
      planMonthlyCredits: updatedUser.planMonthlyCredits,
      carryOverCredits: carryOver,
      addonCredits: updatedUser.addonCredits,
    });
  } catch (error) {
    console.error('Plan Upgrade Error:', error);
    res.status(500).json({ error: 'Failed to upgrade plan', details: error.message, stack: error.stack });
  }
};

// ─── Get Plan Config (for frontend reference) ─────────────────────────────────
const getPlanConfig = (req, res) => {
  res.json({ plans: PLAN_CONFIG, planRank: PLAN_RANK });
};

module.exports = {
  createPaymentIntent,
  verifyPayment,
  dummyTopUp,
  upgradePlan,
  getPlanConfig,
  getTransactions,
};
