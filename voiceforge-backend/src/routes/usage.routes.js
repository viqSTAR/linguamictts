const express = require('express');
const { getUsageAnalytics } = require('../controllers/usage.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(verifyToken);
router.get('/', getUsageAnalytics);

module.exports = router;
