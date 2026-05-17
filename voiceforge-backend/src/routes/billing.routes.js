const express = require('express');
const {
  getPlanConfig,
  getTransactions,
  getSubscriptions,
  cancelSubscription,
  resumeSubscription,
  setAutoPay,
  createDodoCheckout,
  getRefundEligibility,
  refundSubscription,
} = require('../controllers/billing.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// Public — frontend reads plans/topups + the Dodo-enabled flag without auth.
router.get('/plans', getPlanConfig);

// NOTE: the Dodo webhook (/billing/webhook) is mounted directly in index.js
// BEFORE express.json so the raw body is available for HMAC verification.
// It must not pass through this router or the JSON body parser.

// All other billing routes require JWT auth.
router.use(verifyToken);

router.post('/dodo/checkout', createDodoCheckout);
router.get('/transactions', getTransactions);

// Subscription management — per-subscription, since users can stack many.
router.get('/subscriptions', getSubscriptions);
router.post('/subscriptions/:subscriptionId/cancel', cancelSubscription);
router.post('/subscriptions/:subscriptionId/resume', resumeSubscription);
router.post('/subscriptions/:subscriptionId/autopay', setAutoPay);
router.get('/subscriptions/:subscriptionId/refund-eligibility', getRefundEligibility);
router.post('/subscriptions/:subscriptionId/refund', refundSubscription);

module.exports = router;
