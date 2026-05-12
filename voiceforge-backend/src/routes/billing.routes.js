const express = require('express');
const {
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
} = require('../controllers/billing.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// Public — for frontend to know plan credits without auth
router.get('/plans', getPlanConfig);

// All other billing routes require JWT auth
router.use(verifyToken);
router.post('/create-payment-intent', createPaymentIntent);
router.post('/verify', verifyPayment);
router.post('/dummy-topup', dummyTopUp);
router.post('/upgrade-plan', upgradePlan);
router.get('/transactions', getTransactions);

// Subscription management — all reject FREE users at the controller.
router.get('/subscription', getSubscription);
router.post('/subscription/cancel', cancelSubscription);
router.post('/subscription/resume', resumeSubscription);
router.post('/subscription/autopay', setAutoPay);

module.exports = router;
