const express = require('express');
const multer = require('multer');
const { proxyTTS, proxySTT, proxyVoices, proxyStudioTTS, proxyDemoTTS, proxyStudioSTT, proxyStudioDownload } = require('../controllers/proxy.controller');
const { verifyApiKey } = require('../middlewares/api.middleware');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

const MAX_STT_FILE_MB = 25;
const MAX_STT_FILE_BYTES = MAX_STT_FILE_MB * 1024 * 1024;

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_STT_FILE_BYTES },
});

const handleSttUpload = (req, res, next) => {
	upload.single('file')(req, res, (err) => {
		if (!err) return next();
		if (err.code === 'LIMIT_FILE_SIZE') {
			return res.status(400).json({ error: `Audio file too large. Max ${MAX_STT_FILE_MB}MB.` });
		}
		return res.status(400).json({ error: 'Failed to process audio upload' });
	});
};

// Unauthenticated demo endpoint for landing page
router.post('/demo', proxyDemoTTS);

// Studio endpoint (uses JWT auth)
router.post('/studio/tts', verifyToken, proxyStudioTTS);
router.post('/studio/stt', verifyToken, handleSttUpload, proxyStudioSTT);
router.get('/studio/download', verifyToken, proxyStudioDownload);

// Public API endpoints (use API key auth)
router.use(verifyApiKey);
router.post('/tts', proxyTTS);
router.post('/stt', handleSttUpload, proxySTT);
router.get('/voices', proxyVoices);

module.exports = router;
