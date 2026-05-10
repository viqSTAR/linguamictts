const axios = require('axios');
const prisma = require('../utils/prisma');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const { r2Enabled, buildAudioKey, uploadAudioBuffer, deleteAudioObject, getAudioObject } = require('../utils/r2');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const FASTAPI_INTERNAL_KEY = process.env.FASTAPI_INTERNAL_KEY || 'default_dev_key';

const DEMO_MAX_CHARS = 500;
const DEMO_ALLOWED_KEYS = new Set([
  'text',
  'voice',
  'tone',
  'temperature',
  'top_p',
  'repetition_penalty',
  'speed',
]);
const DEMO_ALLOWED_VOICES = new Set(['tara', 'leah', 'jess', 'leo', 'dan', 'mia', 'zac', 'zoe']);

const validateDemoPayload = (body) => {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid demo payload' };
  }

  const keys = Object.keys(body);
  const hasUnknownKeys = keys.some((key) => !DEMO_ALLOWED_KEYS.has(key));
  if (hasUnknownKeys) {
    return { ok: false, error: 'Invalid demo payload' };
  }

  const text = body.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ok: false, error: 'Demo text is required' };
  }
  if (text.length > DEMO_MAX_CHARS) {
    return { ok: false, error: `Demo text too long. Max ${DEMO_MAX_CHARS} chars.` };
  }

  if (body.voice && !DEMO_ALLOWED_VOICES.has(body.voice)) {
    return { ok: false, error: 'Invalid demo voice' };
  }

  return { ok: true };
};

const getUserCredits = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsBalance: true },
  });
  return user ? user.creditsBalance : 0;
};

const deductCreditsAndLog = async ({
  userId,
  apiKeyId,
  endpointType,
  creditsDeducted,
  charsCount,
  emotionTagsCount,
  toneUsed,
}) => {
  if (creditsDeducted <= 0) {
    const creditsRemaining = await getUserCredits(userId);
    return { ok: true, creditsRemaining };
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { creditsBalance: true },
    });

    if (!user) {
      return { ok: false, creditsRemaining: 0 };
    }

    if (user.creditsBalance < creditsDeducted) {
      return { ok: false, creditsRemaining: user.creditsBalance };
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { creditsBalance: { decrement: creditsDeducted } },
    });

    await tx.usageLog.create({
      data: {
        userId,
        apiKeyId,
        endpointType,
        charsCount,
        emotionTagsCount,
        toneUsed,
        creditsDeducted,
      },
    });

    return { ok: true, creditsRemaining: updatedUser.creditsBalance };
  });

  return result;
};

const convertWavToMp3 = async (wavBuffer) => {
  if (!ffmpegPath) return null;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'linguamic-'));
  const wavPath = path.join(tmpDir, 'input.wav');
  const mp3Path = path.join(tmpDir, 'output.mp3');

  try {
    await fs.writeFile(wavPath, wavBuffer);

    await new Promise((resolve, reject) => {
      const ff = spawn(ffmpegPath, ['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-qscale:a', '2', mp3Path]);
      let errBuffer = '';

      ff.stderr.on('data', (data) => {
        errBuffer += data.toString();
      });

      ff.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(errBuffer || 'ffmpeg conversion failed'));
      });
    });

    const mp3Buffer = await fs.readFile(mp3Path);
    return mp3Buffer;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
};

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

    const deduction = await deductCreditsAndLog({
      userId: req.user.id,
      apiKeyId: req.apiKey.id,
      endpointType: 'TTS',
      creditsDeducted,
      charsCount: charCount,
      emotionTagsCount: emotionTags,
      toneUsed: tone,
    });

    if (!deduction.ok) {
      return res.status(402).json({ error: 'Insufficient credits. Please top up your balance.' });
    }

    const updatedBalance = deduction.creditsRemaining;

    // Forward headers but update X-Credits-Remaining
    for (const [key, value] of Object.entries(response.headers)) {
      if (key.toLowerCase() === 'x-credits-remaining') {
        res.setHeader(key, updatedBalance.toString());
      } else {
        res.setHeader(key, value);
      }
    }
    
    // Add chunked headers for live streaming
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    
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

    const deduction = await deductCreditsAndLog({
      userId: req.user.id,
      apiKeyId: req.apiKey.id,
      endpointType: 'STT',
      creditsDeducted,
    });

    if (!deduction.ok) {
      return res.status(402).json({ error: 'Insufficient credits. Please top up your balance.' });
    }

    const updatedBalance = deduction.creditsRemaining;

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
    
    const deduction = await deductCreditsAndLog({
      userId: req.userId,
      endpointType: 'STUDIO_TTS',
      creditsDeducted,
      charsCount: charCount,
    });

    if (!deduction.ok) {
      return res.status(402).json({ error: 'Insufficient credits. Please top up your balance.' });
    }

    for (const [key, value] of Object.entries(response.headers)) {
      if (key.toLowerCase() === 'x-credits-remaining') {
        res.setHeader(key, deduction.creditsRemaining.toString());
      } else {
        res.setHeader(key, value);
      }
    }
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    const audioChunks = [];
    response.data.on('data', (chunk) => {
      audioChunks.push(chunk);
    });

    response.data.on('end', async () => {
      if (!r2Enabled) return;
      try {
        const buffer = Buffer.concat(audioChunks);
        const newKey = buildAudioKey(req.userId, 'wav');
        const uploadResult = await uploadAudioBuffer({ buffer, key: newKey, contentType: 'audio/wav' });

        let mp3Key = null;
        let mp3Url = null;
        const mp3Buffer = await convertWavToMp3(buffer);
        if (mp3Buffer) {
          mp3Key = buildAudioKey(req.userId, 'mp3');
          const mp3Result = await uploadAudioBuffer({ buffer: mp3Buffer, key: mp3Key, contentType: 'audio/mpeg' });
          mp3Url = mp3Result.publicUrl;
        } else {
          console.warn('MP3 conversion skipped: ffmpeg unavailable.');
        }

        await prisma.user.update({
          where: { id: req.userId },
          data: {
            lastAudioKey: newKey,
            lastAudioUrl: uploadResult.publicUrl,
            lastAudioUpdatedAt: new Date(),
            lastAudioMp3Key: mp3Key,
            lastAudioMp3Url: mp3Url,
          },
        });

        if (user.lastAudioKey) {
          await deleteAudioObject(user.lastAudioKey);
        }
        if (user.lastAudioMp3Key) {
          await deleteAudioObject(user.lastAudioMp3Key);
        }
      } catch (err) {
        console.error('R2 upload error:', err.message);
      }
    });

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
    const demoCheck = validateDemoPayload(req.body);
    if (!demoCheck.ok) {
      return res.status(400).json({ error: demoCheck.error });
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
      return response.data.pipe(res);
    }

    for (const [key, value] of Object.entries(response.headers)) {
      res.setHeader(key, value);
    }
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    response.data.pipe(res);
  } catch (error) {
    console.error('Demo TTS Error:', error.message);
    res.status(500).json({ error: 'Demo TTS failed' });
  }
};

const proxyStudioSTT = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.creditsBalance <= 0) {
      return res.status(402).json({ error: 'Insufficient credits.' });
    }

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
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      return res.status(response.status).json(response.data);
    }

    const transcribedText = response.data.text || '';
    const charCount = transcribedText.length;
    const creditsDeducted = charCount > 0 ? charCount : 0; // 1 credit per character

    const deduction = await deductCreditsAndLog({
      userId: req.userId,
      endpointType: 'STUDIO_STT',
      creditsDeducted,
      charsCount: charCount,
    });

    if (!deduction.ok) {
      return res.status(402).json({ error: 'Insufficient credits.' });
    }

    res.json({
      ...response.data,
      billing: {
        creditsDeducted,
        creditsRemaining: deduction.creditsRemaining
      }
    });
  } catch (error) {
    console.error('Studio STT Error:', error.message);
    res.status(500).json({ error: 'Studio STT failed' });
  }
};

const proxyStudioDownload = async (req, res) => {
  try {
    if (!r2Enabled) {
      return res.status(400).json({ error: 'Audio storage not configured.' });
    }

    const format = String(req.query.format || 'wav').toLowerCase();
    const isMp3 = format === 'mp3';

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { lastAudioKey: true, lastAudioMp3Key: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const key = isMp3 ? user.lastAudioMp3Key : user.lastAudioKey;
    if (!key) {
      return res.status(404).json({ error: 'No audio available for download.' });
    }

    const object = await getAudioObject(key);
    if (!object || !object.Body) {
      return res.status(404).json({ error: 'Audio file missing.' });
    }

    const filename = isMp3 ? 'linguamic-audio.mp3' : 'linguamic-audio.wav';
    res.setHeader('Content-Type', object.ContentType || (isMp3 ? 'audio/mpeg' : 'audio/wav'));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (object.ContentLength) {
      res.setHeader('Content-Length', object.ContentLength.toString());
    }

    object.Body.pipe(res);
  } catch (error) {
    console.error('Studio download error:', error.message);
    res.status(500).json({ error: 'Failed to download audio.' });
  }
};

module.exports = {
  proxyTTS,
  proxySTT,
  proxyVoices,
  proxyStudioTTS,
  proxyStudioSTT,
  proxyStudioDownload,
  proxyDemoTTS,
};
