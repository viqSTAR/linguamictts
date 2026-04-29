const express = require('express');
const { createPaymentIntent, verifyPayment } = require('../controllers/billing.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(verifyToken);
router.post('/create-payment-intent', createPaymentIntent);
router.post('/verify', verifyPayment);

module.exports = router;
