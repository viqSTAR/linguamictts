const express = require('express');
const { register, login, getMe, updateMe, googleAuth } = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/me', verifyToken, getMe);
router.put('/me', verifyToken, updateMe);

module.exports = router;
