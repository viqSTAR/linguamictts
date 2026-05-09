const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const prisma = require('../utils/prisma');
const { getMonthKey } = require('../utils/credits');

// Stripe: $1 = 100 cents = 10,000 credits → 1 cent = 100 credits
const CREDITS_PER_CENT = 100;

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

// ─── Stripe: Create Payment Intent ───────────────────────────────────────────
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

// ─── Stripe: Verify Payment ───────────────────────────────────────────────────
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
    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.creditTransaction.create({
        data: {
          userId: req.userId,
          amount: creditsToStore,
          type: 'TOPUP',
          description: `Stripe top-up of $${(amountInCents / 100).toFixed(2)}`,
          referenceId: paymentIntentId,
        },
      });
      return await tx.user.update({
        where: { id: req.userId },
        data: { creditsBalance: { increment: creditsToStore } },
      });
    });
    res.json({ message: 'Payment verified and credits added', newBalance: updatedUser.creditsBalance });
  } catch (error) {
    console.error('Stripe Verify Error:', error);
    res.status(500).json({ error: 'Failed to verify Stripe payment' });
  }
};

// ─── Dummy Top-Up (Add-on credits only, NOT for plan upgrades) ────────────────
const dummyTopUp = async (req, res) => {
  try {
    const { amountUSD } = req.body;
    if (!amountUSD || amountUSD < 1) {
      return res.status(400).json({ error: 'Minimum amount is $1' });
    }
    const creditsToStore = getTopUpCredits(amountUSD);
    const dummyTransactionId = `dummy_topup_${Date.now()}`;
    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.creditTransaction.create({
        data: {
          userId: req.userId,
          amount: creditsToStore,
          type: 'TOPUP',
          description: `Add-on top-up of $${amountUSD}`,
          referenceId: dummyTransactionId,
        },
      });
      return await tx.user.update({
        where: { id: req.userId },
        data: { creditsBalance: { increment: creditsToStore } },
      });
    });
    res.json({
      message: 'Credits added successfully',
      newBalance: updatedUser.creditsBalance,
      creditsAdded: creditsToStore,
    });
  } catch (error) {
    console.error('Dummy TopUp Error:', error);
    res.status(500).json({ error: 'Failed to process top-up' });
  }
};

// ─── Plan Upgrade ─────────────────────────────────────────────────────────────
const upgradePlan = async (req, res) => {
  try {
    const { plan } = req.body;
    const planKey = (plan || '').toUpperCase();

    if (!PLAN_CONFIG[planKey]) {
      return res.status(400).json({ error: 'Invalid plan. Must be STARTER, CREATOR, or PRO.' });
    }

    const config = PLAN_CONFIG[planKey];
    const monthKey = getMonthKey(new Date());

    const updatedUser = await prisma.$transaction(async (tx) => {
      // Remove this month's MONTHLY_RESET so the new tier's allocation applies immediately
      await tx.creditTransaction.deleteMany({
        where: { userId: req.userId, type: 'MONTHLY_RESET', referenceId: monthKey },
      });

      // Upgrade user: set plan fields + grant this month's full allocation
      const user = await tx.user.update({
        where: { id: req.userId },
        data: {
          plan: planKey,
          planMonthlyCredits: config.monthlyCredits,
          planStartedAt: new Date(),
          creditsBalance: config.monthlyCredits,
        },
      });

      // Audit log
      await tx.creditTransaction.create({
        data: {
          userId: req.userId,
          amount: config.monthlyCredits,
          type: 'PLAN_UPGRADE',
          description: `Upgraded to ${planKey} — ${config.monthlyCredits.toLocaleString()} credits granted`,
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
    });
  } catch (error) {
    console.error('Plan Upgrade Error:', error);
    res.status(500).json({ error: 'Failed to upgrade plan' });
  }
};

// ─── Get Plan Config (for frontend reference) ─────────────────────────────────
const getPlanConfig = (req, res) => {
  res.json({ plans: PLAN_CONFIG });
};

module.exports = {
  createPaymentIntent,
  verifyPayment,
  dummyTopUp,
  upgradePlan,
  getPlanConfig,
};
