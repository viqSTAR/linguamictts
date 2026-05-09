const express = require('express');
const { createPaymentIntent, verifyPayment, dummyTopUp, upgradePlan, getPlanConfig } = require('../controllers/billing.controller');
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

module.exports = router;
