const axios = require('axios');
const prisma = require('../utils/prisma');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const { r2Enabled, buildAudioKey, uploadAudioBuffer, deleteAudioObject, getAudioObject } = require('../utils/r2');
const {
  computeTtsCredits,
  computeSttCredits,
  reserveCredits,
  refundCredits,
  logUsage,
} = require('../utils/credits');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const FASTAPI_INTERNAL_KEY = process.env.FASTAPI_INTERNAL_KEY || 'default_dev_key';

// When FASTAPI_URL is an ngrok free tunnel, ngrok intercepts unrecognised
// callers with an HTML browser-warning page. Sending this header bypasses it
// so the request actually reaches FastAPI.
const NGROK_BYPASS_HEADER = { 'ngrok-skip-browser-warning': 'true' };

// ── RunPod Serverless mode ──────────────────────────────────────────────────
// When both vars are set, all TTS/STT/Voices calls go through RunPod's job API
// instead of directly to FastAPI. Set in Render env vars after deploying the
// RunPod endpoint. Leave unset for local dev (falls back to direct HTTP).
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID || '';
const RUNPOD_API_KEY     = process.env.RUNPOD_API_KEY     || '';
const USE_RUNPOD = Boolean(RUNPOD_ENDPOINT_ID && RUNPOD_API_KEY);

/**
 * Call the RunPod /runsync endpoint and return the parsed output object.
 * Throws on network error; returns { error } on RunPod-level failure.
 *
 * @param {object} input - Job input sent as { input: <input> }
 * @param {number} [timeoutMs=310000] - Axios timeout in ms (slightly > RunPod's max 300 s)
 */
async function runpodCall(input, timeoutMs = 310000) {
  const deadline = Date.now() + timeoutMs;
  // RunPod's /runsync holds the HTTP connection for ~90s then returns the job
  // in IN_QUEUE/IN_PROGRESS if the worker is still cold-starting. We use 95s
  // to capture that sync window, then fall back to polling /status/{jobId}.
  const RUNSYNC_TIMEOUT_MS = 95000;

  const syncUrl = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/runsync`;
  const authHeaders = { Authorization: `Bearer ${RUNPOD_API_KEY}`, 'Content-Type': 'application/json' };

  const resp = await axios.post(
    syncUrl,
    { input },
    { headers: authHeaders, timeout: RUNSYNC_TIMEOUT_MS, validateStatus: () => true },
  );

  if (resp.status !== 200) {
    throw new Error(`RunPod HTTP ${resp.status}: ${JSON.stringify(resp.data).slice(0, 300)}`);
  }

  const syncBody = resp.data;

  if (syncBody.status === 'COMPLETED') {
    const output = syncBody.output || {};
    if (!output.audio_base64 || Buffer.from(output.audio_base64, 'base64').length < 200) {
      return { error: 'TTS engine returned empty audio. Please try again.' };
    }
    return output;
  }

  if (syncBody.status === 'FAILED' || syncBody.status === 'CANCELLED') {
    return { error: `RunPod job ${syncBody.status}: ${syncBody.error || 'unknown'}` };
  }

  // Job is IN_QUEUE or IN_PROGRESS (cold-start) — poll /status/{jobId} until done
  const jobId = syncBody.id;
  if (!jobId) {
    throw new Error(`RunPod returned no job id: ${JSON.stringify(syncBody).slice(0, 200)}`);
  }

  const statusUrl = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${jobId}`;
  console.info(`[runpod] job ${jobId} is ${syncBody.status}, polling (${Math.round((deadline - Date.now()) / 1000)}s left)`);

  let pollIntervalMs = 3000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    pollIntervalMs = Math.min(pollIntervalMs + 1000, 10000);

    let pollResp;
    try {
      pollResp = await axios.get(statusUrl, {
        headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
        timeout: 15000,
        validateStatus: () => true,
      });
    } catch (pollErr) {
      console.warn(`[runpod] poll error for job ${jobId}:`, pollErr.message);
      continue;
    }

    if (pollResp.status !== 200) continue;

    const pollBody = pollResp.data;
    console.info(`[runpod] job ${jobId} status: ${pollBody.status}`);

    if (pollBody.status === 'COMPLETED') {
      const output = pollBody.output || {};
      if (!output.audio_base64 || Buffer.from(output.audio_base64, 'base64').length < 200) {
        return { error: 'TTS engine returned empty audio. Please try again.' };
      }
      return output;
    }

    if (pollBody.status === 'FAILED' || pollBody.status === 'CANCELLED') {
      return { error: `RunPod job ${pollBody.status}: ${pollBody.error || 'unknown'}` };
    }
    // IN_QUEUE / IN_PROGRESS — keep polling
  }

  return { error: 'RunPod job timed out. The TTS engine may be warming up — please try again.' };
}

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
const DEMO_ALLOWED_TONES = new Set([
  'calm', 'romantic', 'storytelling', 'horror', 'angry',
  'adventurous', 'excited', 'sad', 'funny',
]);

// Defensive numeric bounds so a tampered request can't blow up the model.
const NUMERIC_BOUNDS = {
  temperature: { min: 0, max: 1.5 },
  top_p: { min: 0, max: 1 },
  repetition_penalty: { min: 1, max: 2 },
  speed: { min: 0.5, max: 2 },
};

const isInRange = (value, bound) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return value >= bound.min && value <= bound.max;
};

const validateTtsPayload = (body, { maxChars }) => {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }
  if (typeof body.text !== 'string' || body.text.trim().length === 0) {
    return { ok: false, error: 'Text is required' };
  }
  if (typeof maxChars === 'number' && body.text.length > maxChars) {
    return { ok: false, error: `Text too long. Max ${maxChars} chars.` };
  }
  if (body.voice !== undefined && (typeof body.voice !== 'string' || body.voice.length > 32)) {
    return { ok: false, error: 'Invalid voice' };
  }
  if (body.tone !== undefined && body.tone !== null && (typeof body.tone !== 'string' || body.tone.length > 32)) {
    return { ok: false, error: 'Invalid tone' };
  }
  for (const key of ['temperature', 'top_p', 'repetition_penalty', 'speed']) {
    if (body[key] !== undefined && body[key] !== null && !isInRange(body[key], NUMERIC_BOUNDS[key])) {
      return { ok: false, error: `Invalid ${key}` };
    }
  }
  return { ok: true };
};

const validateDemoPayload = (body) => {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid demo payload' };
  }

  const keys = Object.keys(body);
  const hasUnknownKeys = keys.some((key) => !DEMO_ALLOWED_KEYS.has(key));
  if (hasUnknownKeys) {
    return { ok: false, error: 'Invalid demo payload' };
  }

  const base = validateTtsPayload(body, { maxChars: DEMO_MAX_CHARS });
  if (!base.ok) return base;

  if (body.voice && !DEMO_ALLOWED_VOICES.has(body.voice)) {
    return { ok: false, error: 'Invalid demo voice' };
  }
  if (body.tone && !DEMO_ALLOWED_TONES.has(body.tone)) {
    return { ok: false, error: 'Invalid demo tone' };
  }

  return { ok: true };
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
      let settled = false;

      const finish = (err) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };

      ff.stderr.on('data', (data) => { errBuffer += data.toString(); });
      ff.on('error', (err) => finish(err));
      ff.on('close', (code) => {
        if (code === 0) finish();
        else finish(new Error(errBuffer || `ffmpeg exited with code ${code}`));
      });
    });

    const mp3Buffer = await fs.readFile(mp3Path);
    return mp3Buffer;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
};

// Common reserve→call→reconcile flow used by both API-key and Studio TTS.
// Returns the upstream axios response on success, or null after sending an error.
const performBilledTts = async ({ req, res, userId, apiKeyId, endpointType }) => {
  const payloadCheck = validateTtsPayload(req.body, { maxChars: 50000 });
  if (!payloadCheck.ok) {
    res.status(400).json({ error: payloadCheck.error });
    return null;
  }

  const { charCount, emotionCount, credits: expectedCredits } = computeTtsCredits(req.body.text);

  const reservation = await reserveCredits(userId, expectedCredits);
  if (!reservation.ok) {
    res.status(402).json({ error: 'Insufficient credits. Please top up your balance.' });
    return null;
  }

  // ── Call TTS engine (RunPod Serverless or direct FastAPI) ─────────────────
  let fastapiCredits, fastapiCharCount, fastapiEmotion, tone;
  let audioStream; // Readable stream of WAV bytes forwarded to callers

  if (USE_RUNPOD) {
    // RunPod Serverless: synchronous job, audio returned as base64.
    let output;
    try {
      output = await runpodCall({ action: 'tts', ...req.body });
    } catch (err) {
      await refundCredits(userId, expectedCredits);
      console.error(`${endpointType} RunPod error:`, err.message);
      res.status(502).json({ error: 'Failed to reach TTS engine (RunPod)' });
      return null;
    }

    if (output.error) {
      await refundCredits(userId, expectedCredits);
      res.status(500).json({ error: output.error });
      return null;
    }

    const audioBuffer = Buffer.from(output.audio_base64 || '', 'base64');
    fastapiCredits   = output.credits_deducted   || 0;
    fastapiCharCount = output.char_count          || 0;
    fastapiEmotion   = output.emotion_tag_count   || 0;
    tone             = output.tone                || null;

    // Wrap buffer in a Readable so callers can .pipe() it exactly like an
    // axios streaming response — no callers need to change.
    const { Readable } = require('stream');
    const readable = new Readable({ read() {} });
    readable.push(audioBuffer);
    readable.push(null);
    audioStream = { data: readable, headers: {} };

  } else {
    // Direct FastAPI (local dev / plain Pod).
    let response;
    try {
      response = await axios.post(`${FASTAPI_URL}/v1/tts`, req.body, {
        headers: {
          'Authorization': `Bearer ${FASTAPI_INTERNAL_KEY}`,
          'Content-Type': 'application/json',
          ...NGROK_BYPASS_HEADER,
        },
        responseType: 'stream',
        validateStatus: () => true,
      });
    } catch (err) {
      await refundCredits(userId, expectedCredits);
      console.error(`${endpointType} upstream error:`, err.message);
      res.status(502).json({ error: 'Failed to reach TTS engine' });
      return null;
    }

    if (response.status !== 200) {
      await refundCredits(userId, expectedCredits);
      res.status(response.status);
      for (const [key, value] of Object.entries(response.headers)) {
        res.setHeader(key, value);
      }
      response.data.pipe(res);
      return null;
    }

    fastapiCredits   = parseInt(response.headers['x-credits-deducted']  || '0', 10);
    fastapiCharCount = parseInt(response.headers['x-char-count']         || '0', 10);
    fastapiEmotion   = parseInt(response.headers['x-emotion-tag-count']  || '0', 10);
    tone             = response.headers['x-tone'] || null;
    audioStream      = response;
  }

  // Reconcile: we trust our own pre-computed credits as the authoritative
  // deduction; refund the diff if the engine saw fewer billable units.

  let finalCredits = expectedCredits;
  let finalChars = charCount;
  let finalEmotion = emotionCount;

  if (fastapiCredits > 0 && fastapiCredits < expectedCredits) {
    const diff = expectedCredits - fastapiCredits;
    await refundCredits(userId, diff);
    finalCredits = fastapiCredits;
    finalChars = fastapiCharCount || charCount;
    finalEmotion = fastapiEmotion || emotionCount;
  }

  await logUsage({
    userId,
    apiKeyId,
    endpointType,
    charsCount: finalChars,
    emotionTagsCount: finalEmotion,
    toneUsed: tone,
    creditsDeducted: finalCredits,
  });

  // Re-read the authoritative balance. The reservation already deducted
  // expectedCredits and the reconciliation above may have refunded the diff,
  // so a single live read is the simplest source of truth.
  const fresh = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsBalance: true },
  });
  const fallbackBalance = reservation.balance + (expectedCredits - finalCredits);
  const authoritativeBalance = fresh ? fresh.creditsBalance : fallbackBalance;

  // Forward upstream headers but override x-credits-* with the authoritative
  // values we computed and persisted.
  // NOTE: use audioStream.headers — in the RunPod branch `response` is not in
  // scope; audioStream is the unified handle for both paths.
  for (const [key, value] of Object.entries(audioStream.headers || {})) {
    const lower = key.toLowerCase();
    if (lower === 'x-credits-remaining' || lower === 'x-credits-deducted') continue;
    res.setHeader(key, value);
  }
  res.setHeader('x-credits-remaining', authoritativeBalance.toString());
  res.setHeader('x-credits-deducted', finalCredits.toString());
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Expose-Headers', 'x-credits-remaining, x-credits-deducted, x-char-count, x-emotion-tag-count, x-tone');

  return audioStream;
};

const proxyTTS = async (req, res) => {
  try {
    const response = await performBilledTts({
      req,
      res,
      userId: req.user.id,
      apiKeyId: req.apiKey ? req.apiKey.id : null,
      endpointType: 'TTS',
    });
    if (!response) return;
    response.data.pipe(res);
  } catch (error) {
    console.error('Proxy TTS Error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to communicate with TTS engine' });
  }
};

const proxySTT = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    // STT cost is duration-based; reserve a generous minimum so the request
    // can run even before we know the actual duration. We reconcile after.
    const RESERVE_MIN = 60; // ~30 seconds worth at 2 credits/sec
    const reservation = await reserveCredits(req.user.id, RESERVE_MIN);
    if (!reservation.ok) {
      return res.status(402).json({ error: 'Insufficient credits. Please top up your balance.' });
    }

    let response;
    if (USE_RUNPOD) {
      try {
        const audio_base64 = req.file.buffer.toString('base64');
        const output = await runpodCall(
          { action: 'stt', audio_base64, filename: req.file.originalname },
          130000,
        );
        if (output.error) {
          await refundCredits(req.user.id, RESERVE_MIN);
          return res.status(500).json({ error: output.error });
        }
        response = { status: 200, data: output };
      } catch (err) {
        await refundCredits(req.user.id, RESERVE_MIN);
        console.error('STT RunPod error:', err.message);
        return res.status(502).json({ error: 'Failed to reach STT engine (RunPod)' });
      }
    } else {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', req.file.buffer, req.file.originalname);
      try {
        response = await axios.post(`${FASTAPI_URL}/v1/stt`, form, {
          headers: {
            'Authorization': `Bearer ${FASTAPI_INTERNAL_KEY}`,
            ...form.getHeaders(),
            ...NGROK_BYPASS_HEADER,
          },
          validateStatus: () => true,
        });
      } catch (err) {
        await refundCredits(req.user.id, RESERVE_MIN);
        console.error('STT upstream error:', err.message);
        return res.status(502).json({ error: 'Failed to reach STT engine' });
      }
    }

    if (response.status !== 200) {
      await refundCredits(req.user.id, RESERVE_MIN);
      return res.status(response.status).json(response.data);
    }

    const duration = response.data.duration || 0;
    const actualCredits = computeSttCredits(duration);

    if (actualCredits < RESERVE_MIN) {
      await refundCredits(req.user.id, RESERVE_MIN - actualCredits);
    } else if (actualCredits > RESERVE_MIN) {
      // Need to charge the rest; if the second reservation fails the user got
      // a small free credit but no overdraft. Acceptable.
      const extra = actualCredits - RESERVE_MIN;
      const more = await reserveCredits(req.user.id, extra);
      if (!more.ok) {
        console.warn(`STT under-billed by ${extra} credits (user ${req.user.id})`);
      }
    }

    await logUsage({
      userId: req.user.id,
      apiKeyId: req.apiKey ? req.apiKey.id : null,
      endpointType: 'STT',
      creditsDeducted: actualCredits,
    });

    const fresh = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { creditsBalance: true },
    });

    res.json({
      ...response.data,
      billing: {
        creditsDeducted: actualCredits,
        creditsRemaining: fresh ? fresh.creditsBalance : reservation.balance,
      },
    });
  } catch (error) {
    console.error('Proxy STT Error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to communicate with STT engine' });
  }
};

const proxyVoices = async (req, res) => {
  try {
    if (USE_RUNPOD) {
      const output = await runpodCall({ action: 'voices' }, 30000);
      if (output.error) return res.status(500).json({ error: output.error });
      return res.json(output);
    }

    const response = await axios.get(`${FASTAPI_URL}/v1/voices`, {
      headers: {
        'Authorization': `Bearer ${FASTAPI_INTERNAL_KEY}`,
        ...NGROK_BYPASS_HEADER,
      },
      validateStatus: () => true,
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

// Atomically swaps the user's lastAudio{Key,Url,Mp3Key,Mp3Url} fields and
// returns the previous keys so the caller can delete only the objects this
// request actually displaced. Two concurrent studio requests will not delete
// each other's freshly-uploaded objects.
const swapLastAudio = async (userId, { newKey, newUrl, newMp3Key, newMp3Url }) => {
  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: userId },
      select: { lastAudioKey: true, lastAudioMp3Key: true },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        lastAudioKey: newKey,
        lastAudioUrl: newUrl,
        lastAudioUpdatedAt: new Date(),
        lastAudioMp3Key: newMp3Key,
        lastAudioMp3Url: newMp3Url,
      },
    });
    return {
      prevWavKey: current ? current.lastAudioKey : null,
      prevMp3Key: current ? current.lastAudioMp3Key : null,
    };
  });
};

const proxyStudioTTS = async (req, res) => {
  try {
    const response = await performBilledTts({
      req,
      res,
      userId: req.userId,
      apiKeyId: null,
      endpointType: 'STUDIO_TTS',
    });
    if (!response) return;

    const audioChunks = [];
    response.data.on('data', (chunk) => audioChunks.push(chunk));

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

        const { prevWavKey, prevMp3Key } = await swapLastAudio(req.userId, {
          newKey,
          newUrl: uploadResult.publicUrl,
          newMp3Key: mp3Key,
          newMp3Url: mp3Url,
        });

        if (prevWavKey && prevWavKey !== newKey) {
          await deleteAudioObject(prevWavKey).catch((e) => console.warn('R2 delete failed:', e.message));
        }
        if (prevMp3Key && prevMp3Key !== mp3Key) {
          await deleteAudioObject(prevMp3Key).catch((e) => console.warn('R2 delete failed:', e.message));
        }
      } catch (err) {
        console.error('R2 upload error:', err.message);
      }
    });

    response.data.pipe(res);
  } catch (error) {
    console.error('Studio TTS Error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Studio TTS failed' });
  }
};

const proxyDemoTTS = async (req, res) => {
  try {
    const demoCheck = validateDemoPayload(req.body);
    if (!demoCheck.ok) {
      return res.status(400).json({ error: demoCheck.error });
    }

    if (USE_RUNPOD) {
      let output;
      try {
        output = await runpodCall({ action: 'tts', ...req.body });
      } catch (err) {
        console.error('Demo TTS RunPod error:', err.message);
        return res.status(502).json({ error: 'Demo TTS failed' });
      }
      if (output.error) return res.status(500).json({ error: output.error });
      const audioBuffer = Buffer.from(output.audio_base64 || '', 'base64');
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(audioBuffer);
    }

    const response = await axios.post(`${FASTAPI_URL}/v1/tts`, req.body, {
      headers: {
        'Authorization': `Bearer ${FASTAPI_INTERNAL_KEY}`,
        'Content-Type': 'application/json',
        ...NGROK_BYPASS_HEADER,
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
    if (!res.headersSent) res.status(500).json({ error: 'Demo TTS failed' });
  }
};

const proxyStudioSTT = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const RESERVE_MIN = 60;
    const reservation = await reserveCredits(req.userId, RESERVE_MIN);
    if (!reservation.ok) {
      return res.status(402).json({ error: 'Insufficient credits.' });
    }

    let response;
    if (USE_RUNPOD) {
      try {
        const audio_base64 = req.file.buffer.toString('base64');
        const output = await runpodCall(
          { action: 'stt', audio_base64, filename: req.file.originalname },
          130000,
        );
        if (output.error) {
          await refundCredits(req.userId, RESERVE_MIN);
          return res.status(500).json({ error: output.error });
        }
        response = { status: 200, data: output };
      } catch (err) {
        await refundCredits(req.userId, RESERVE_MIN);
        console.error('Studio STT RunPod error:', err.message);
        return res.status(502).json({ error: 'Failed to reach STT engine (RunPod)' });
      }
    } else {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', req.file.buffer, req.file.originalname);
      try {
        response = await axios.post(`${FASTAPI_URL}/v1/stt`, form, {
          headers: {
            'Authorization': `Bearer ${FASTAPI_INTERNAL_KEY}`,
            ...form.getHeaders(),
            ...NGROK_BYPASS_HEADER,
          },
          validateStatus: () => true,
        });
      } catch (err) {
        await refundCredits(req.userId, RESERVE_MIN);
        console.error('Studio STT upstream error:', err.message);
        return res.status(502).json({ error: 'Failed to reach STT engine' });
      }
    }

    if (response.status !== 200) {
      await refundCredits(req.userId, RESERVE_MIN);
      return res.status(response.status).json(response.data);
    }

    const duration = response.data.duration || 0;
    const actualCredits = computeSttCredits(duration);
    const transcribedText = response.data.text || '';

    if (actualCredits < RESERVE_MIN) {
      await refundCredits(req.userId, RESERVE_MIN - actualCredits);
    } else if (actualCredits > RESERVE_MIN) {
      const extra = actualCredits - RESERVE_MIN;
      const more = await reserveCredits(req.userId, extra);
      if (!more.ok) {
        console.warn(`Studio STT under-billed by ${extra} credits (user ${req.userId})`);
      }
    }

    await logUsage({
      userId: req.userId,
      endpointType: 'STUDIO_STT',
      charsCount: transcribedText.length,
      creditsDeducted: actualCredits,
    });

    const fresh = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { creditsBalance: true },
    });

    res.json({
      ...response.data,
      billing: {
        creditsDeducted: actualCredits,
        creditsRemaining: fresh ? fresh.creditsBalance : reservation.balance,
      },
    });
  } catch (error) {
    console.error('Studio STT Error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Studio STT failed' });
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
