const express = require('express');
const multer = require('multer');
const { proxyTTS, proxySTT, proxyVoices, proxyStudioTTS, proxyDemoTTS } = require('../controllers/proxy.controller');
const { verifyApiKey } = require('../middlewares/api.middleware');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Unauthenticated demo endpoint for landing page
router.post('/demo', proxyDemoTTS);

// Studio endpoint (uses JWT auth)
router.post('/studio/tts', verifyToken, proxyStudioTTS);

// Public API endpoints (use API key auth)
router.use(verifyApiKey);
router.post('/tts', proxyTTS);
router.post('/stt', upload.single('file'), proxySTT);
router.get('/voices', proxyVoices);

module.exports = router;
