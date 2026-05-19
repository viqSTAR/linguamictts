const express = require('express');
const { register, login, getMe, updateMe, googleAuth, forgotPassword, resetPassword } = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/me', verifyToken, getMe);
router.put('/me', verifyToken, updateMe);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
