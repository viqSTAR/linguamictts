const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Restrict CORS to known frontend origins only
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,          // e.g. https://linguamic.vercel.app
  'http://localhost:3000',            // local dev
  'http://localhost:4000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server (no origin) and known origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Linguamic Backend is running' });
});

const rateLimit = require('express-rate-limit');

// Global Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/auth', limiter); // Stricter on auth if needed, but applying globally or to specific
app.use('/v1', limiter); // Limit API endpoints

// Routes
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

// Start the server if this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Express] Server running on port ${PORT}`);
  });
}

module.exports = app;

