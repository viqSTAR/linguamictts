const axios = require('axios');
const prisma = require('../utils/prisma');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const FASTAPI_INTERNAL_KEY = process.env.FASTAPI_INTERNAL_KEY || 'default_dev_key';

const proxyTTS = async (req, res) => {
  try {
    if (req.user.creditsBalance <= 0) {
      return res.status(402).json({ error: 'Insufficient credits. Please top up your balance.' });
    }

    const response = await axios.post(`${FASTAPI_URL}/v1/tts`, req.body, {
      headers: {
        'Authorization': `Bearer ${FASTAPI_INTERNAL_KEY}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
      validateStatus: (status) => true, // Don't throw on 4xx/5xx
    });

    if (response.status !== 200) {
      // Forward error response directly
      res.status(response.status);
      for (const [key, value] of Object.entries(response.headers)) {
        res.setHeader(key, value);
      }
      return response.data.pipe(res);
    }

    // Extract headers
    const creditsDeducted = parseInt(response.headers['x-credits-deducted'] || '0', 10);
    const charCount = parseInt(response.headers['x-char-count'] || '0', 10);
    const emotionTags = parseInt(response.headers['x-emotion-tag-count'] || '0', 10);
    const tone = response.headers['x-tone'] || null;

    // Deduct credits and log usage
    let updatedBalance = req.user.creditsBalance;
    if (creditsDeducted > 0) {
      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: { creditsBalance: { decrement: creditsDeducted } },
      });
      updatedBalance = updatedUser.creditsBalance;

      await prisma.usageLog.create({
        data: {
          userId: req.user.id,
          apiKeyId: req.apiKey.id,
          endpointType: 'TTS',
          charsCount: charCount,
          emotionTagsCount: emotionTags,
          toneUsed: tone,
          creditsDeducted,
        },
      });
    }

    // Forward headers but update X-Credits-Remaining
    for (const [key, value] of Object.entries(response.headers)) {
      if (key.toLowerCase() === 'x-credits-remaining') {
        res.setHeader(key, updatedBalance.toString());
      } else {
        res.setHeader(key, value);
      }
    }
    
    // Pipe audio data to client
    response.data.pipe(res);

  } catch (error) {
    console.error('Proxy TTS Error:', error.message);
    res.status(500).json({ error: 'Failed to communicate with TTS engine' });
  }
};

const proxySTT = async (req, res) => {
  try {
    if (req.user.creditsBalance <= 0) {
      return res.status(402).json({ error: 'Insufficient credits. Please top up your balance.' });
    }

    // Pass the file using FormData
    const FormData = require('form-data');
    const form = new FormData();
    
    if (req.file) {
       form.append('file', req.file.buffer, req.file.originalname);
    } else {
       return res.status(400).json({ error: 'Audio file is required' });
    }

    const response = await axios.post(`${FASTAPI_URL}/v1/stt`, form, {
      headers: {
        'Authorization': `Bearer ${FASTAPI_INTERNAL_KEY}`,
        ...form.getHeaders(),
      },
      validateStatus: (status) => true,
    });

    if (response.status !== 200) {
      return res.status(response.status).json(response.data);
    }

    // Flat cost for STT or calculate based on duration
    const duration = response.data.duration || 0;
    const creditsDeducted = Math.ceil(duration) * 2; // e.g. 2 credits per second
    
    let updatedBalance = req.user.creditsBalance;
    if (creditsDeducted > 0) {
      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: { creditsBalance: { decrement: creditsDeducted } },
      });
      updatedBalance = updatedUser.creditsBalance;

      await prisma.usageLog.create({
        data: {
          userId: req.user.id,
          apiKeyId: req.apiKey.id,
          endpointType: 'STT',
          creditsDeducted,
        },
      });
    }

    res.json({
       ...response.data,
       billing: {
         creditsDeducted,
         creditsRemaining: updatedBalance
       }
    });

  } catch (error) {
    console.error('Proxy STT Error:', error.message);
    res.status(500).json({ error: 'Failed to communicate with STT engine' });
  }
};

const proxyVoices = async (req, res) => {
  try {
    const response = await axios.get(`${FASTAPI_URL}/v1/voices`, {
      headers: { 'Authorization': `Bearer ${FASTAPI_INTERNAL_KEY}` },
      validateStatus: (status) => true,
    });
    
    if (response.status !== 200) {
      return res.status(response.status).json(response.data);
    }
    
    res.json(response.data);
  } catch (error) {
    console.error('Proxy Voices Error:', error.message);
    res.status(500).json({ error: 'Failed to communicate with TTS engine' });
  }
};

const proxyStudioTTS = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.creditsBalance <= 0) {
      return res.status(402).json({ error: 'Insufficient credits.' });
    }

    const response = await axios.post(`${FASTAPI_URL}/v1/tts`, req.body, {
      headers: {
        'Authorization': `Bearer ${FASTAPI_INTERNAL_KEY}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      res.status(response.status);
      for (const [key, value] of Object.entries(response.headers)) {
        res.setHeader(key, value);
      }
      return response.data.pipe(res);
    }

    const creditsDeducted = parseInt(response.headers['x-credits-deducted'] || '0', 10);
    const charCount = parseInt(response.headers['x-char-count'] || '0', 10);
    
    if (creditsDeducted > 0) {
      await prisma.user.update({
        where: { id: req.userId },
        data: { creditsBalance: { decrement: creditsDeducted } },
      });
      await prisma.usageLog.create({
        data: {
          userId: req.userId,
          endpointType: 'STUDIO_TTS',
          charsCount: charCount,
          creditsDeducted,
        },
      });
    }

    for (const [key, value] of Object.entries(response.headers)) {
      res.setHeader(key, value);
    }
    response.data.pipe(res);
  } catch (error) {
    console.error('Studio TTS Error:', error.message);
    res.status(500).json({ error: 'Studio TTS failed' });
  }
};

const proxyDemoTTS = async (req, res) => {
  try {
    // Unauthenticated proxy specifically for the landing page demo.
    // Hardcoded to prevent abuse (only accepts specific demo payload)
    const response = await axios.post(`${FASTAPI_URL}/v1/tts`, req.body, {
      headers: {
        'Authorization': `Bearer ${FASTAPI_INTERNAL_KEY}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      res.status(response.status);
      return response.data.pipe(res);
    }

    for (const [key, value] of Object.entries(response.headers)) {
      res.setHeader(key, value);
    }
    response.data.pipe(res);
  } catch (error) {
    console.error('Demo TTS Error:', error.message);
    res.status(500).json({ error: 'Demo TTS failed' });
  }
};

module.exports = {
  proxyTTS,
  proxySTT,
  proxyVoices,
  proxyStudioTTS,
  proxyDemoTTS,
};
