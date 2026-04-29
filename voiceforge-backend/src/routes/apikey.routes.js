const express = require('express');
const { listKeys, createKey, revokeKey } = require('../controllers/apikey.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(verifyToken);

router.get('/', listKeys);
router.post('/', createKey);
router.delete('/:keyId', revokeKey);

module.exports = router;
