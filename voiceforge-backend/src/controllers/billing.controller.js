const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const prisma = require('../utils/prisma');

// Conversion: $1 = 1000 credits.
// Stripe processes amounts in cents. $1 = 100 cents.
// So 1 cent = 10 credits.
const CREDITS_PER_CENT = 10;

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
      metadata: {
        userId: req.userId,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Stripe Create Order Error:', error);
    res.status(500).json({ error: 'Failed to create Stripe payment intent', details: error.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment Intent ID is required' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: `Payment status is ${paymentIntent.status}, not succeeded` });
    }

    // Check if we already processed this payment intent
    const existingTransaction = await prisma.creditTransaction.findFirst({
      where: { referenceId: paymentIntentId }
    });

    if (existingTransaction) {
      return res.status(400).json({ error: 'Payment already processed' });
    }

    const amountInCents = paymentIntent.amount;
    const creditsToStore = amountInCents * CREDITS_PER_CENT;

    // Run within a Prisma transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Create transaction log
      await tx.creditTransaction.create({
        data: {
          userId: req.userId,
          amount: creditsToStore,
          type: 'TOPUP',
          description: `Stripe top-up of $${(amountInCents / 100).toFixed(2)}`,
          referenceId: paymentIntentId,
        },
      });

      // Update user balance
      return await tx.user.update({
        where: { id: req.userId },
        data: { creditsBalance: { increment: creditsToStore } },
      });
    });

    res.json({
      message: 'Payment verified and credits added',
      newBalance: updatedUser.creditsBalance,
    });
  } catch (error) {
    console.error('Stripe Verify Error:', error);
    res.status(500).json({ error: 'Failed to verify Stripe payment' });
  }
};

module.exports = {
  createPaymentIntent,
  verifyPayment,
};
