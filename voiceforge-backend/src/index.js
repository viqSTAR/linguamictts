const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

// ── Required env validation ───────────────────────────────────────────────────
// Fail fast at boot instead of at first request. The list is intentionally
// minimal — Stripe / R2 / GOOGLE keys are optional (features degrade gracefully).
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  if (require.main === module) {
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 4000;

// Behind Vercel / Railway / Render we sit behind a reverse proxy, so
// express-rate-limit and req.ip must consult X-Forwarded-For. Trust ONE hop —
// not `true` (which trusts any value and lets attackers spoof IPs).
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://linguamic.com',
  'https://www.linguamic.com',
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:4000',
].filter(Boolean);

// Match official Vercel preview pattern for THIS project's deployments only.
// Format: linguamic-<hash>-<team-slug>.vercel.app
// Tightened from the old open-ended `linguamic.*\.vercel\.app` which would
// have allowed any account squatting on `linguamic-evil.vercel.app`.
const VERCEL_PREVIEW_RE = /^https:\/\/linguamic(-[a-z0-9-]+)?\.vercel\.app$/;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (VERCEL_PREVIEW_RE.test(origin)) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
// TTS text bodies are small; cap at 256kb to bound the abuse surface.
app.use(express.json({ limit: '256kb' }));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Linguamic Backend is running' });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
const rateLimit = require('express-rate-limit');

// General limiter for authed traffic.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Strict limiter specifically for auth endpoints — credential stuffing
// protection. 10 attempts per IP per 15 minutes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

// Very strict limiter for the unauthenticated demo endpoint — protects the
// GPU from anonymous load. 5 generations per IP per hour.
const demoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demo limit reached. Sign up for unlimited generations.' },
});

app.use('/auth', authLimiter);
app.use('/v1/demo', demoLimiter);
app.use('/v1', generalLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth.routes');
const apiKeyRoutes = require('./routes/apikey.routes');
const proxyRoutes = require('./routes/proxy.routes');
const usageRoutes = require('./routes/usage.routes');
const billingRoutes = require('./routes/billing.routes');

app.use('/auth', authRoutes);
app.use('/api-keys', apiKeyRoutes);
app.use('/v1', proxyRoutes);
app.use('/usage', usageRoutes);
app.use('/billing', billingRoutes);

// ── Centralized error handler (last) ──────────────────────────────────────────
// Catches CORS rejections and any uncaught controller errors so we always
// return JSON instead of an HTML error page.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && /CORS/.test(err.message)) {
    return res.status(403).json({ error: err.message });
  }
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Express] Server running on port ${PORT}`);
  });
}

module.exports = app;
