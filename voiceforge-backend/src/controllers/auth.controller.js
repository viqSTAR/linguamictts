const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const prisma = require('../utils/prisma');
const { FIRST_MONTH_FREE_CREDITS } = require('../utils/credits');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const validateCredentials = ({ email, password }) => {
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return 'A valid email is required';
  }
  if (email.length > 254) {
    return 'Email is too long';
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return 'Password is too long';
  }
  return null;
};

const issueDefaultApiKey = async (userId) => {
  const rawApiKey = crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');
  const prefix = `vf_${rawApiKey.substring(0, 4)}`;

  await prisma.apiKey.create({
    data: { userId, keyHash, prefix, name: 'Default API Key' },
  });

  return rawApiKey;
};

const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const validationError = validateCredentials({ email, password });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: typeof name === 'string' ? name.trim().slice(0, 80) : null,
          creditsBalance: FIRST_MONTH_FREE_CREDITS,
          freeCreditsRemaining: FIRST_MONTH_FREE_CREDITS,
        },
      });
    } catch (err) {
      if (err && err.code === 'P2002') {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
      throw err;
    }

    const rawApiKey = await issueDefaultApiKey(user.id);
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        creditsBalance: user.creditsBalance,
        addonCredits: user.addonCredits,
        freeCreditsRemaining: user.freeCreditsRemaining,
      },
      apiKey: rawApiKey,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Constant-time-ish check: run bcrypt.compare even when user is missing,
    // so attackers can't enumerate accounts via response time.
    const stubHash = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8s8YQbE5L7r9z3jY4PqW3yX5Q7wG6S';
    const isMatch = user
      ? await bcrypt.compare(password, user.passwordHash)
      : (await bcrypt.compare(password, stubHash), false);

    if (!user || !isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        creditsBalance: user.creditsBalance,
        addonCredits: user.addonCredits,
        freeCreditsRemaining: user.freeCreditsRemaining,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        creditsBalance: true,
        addonCredits: true,
        freeCreditsRemaining: true,
        freeMonthKey: true,
        createdAt: true,
        lastAudioUrl: true,
        lastAudioMp3Url: true,
        lastAudioUpdatedAt: true,
        presets: true,
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'CANCELED', 'ON_HOLD', 'FAILED'] } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            planKey: true,
            monthlyCredits: true,
            creditsRemaining: true,
            status: true,
            autoRenew: true,
            currentPeriodEnd: true,
            canceledAt: true,
            createdAt: true,
          },
        },
        addonGrants: {
          // Surface every top-up the user has purchased — even fully drained
          // ones (creditsRemaining=0) so they have a record of their history.
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amountUSD: true,
            originalAmount: true,
            creditsRemaining: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify a Google access token via the tokeninfo endpoint to confirm the
// audience matches our client_id (defeats the cross-client token replay
// attack), then fetch the actual profile from userinfo. tokeninfo for OAuth
// access tokens does NOT always include `email` even if the token has that
// scope — userinfo is the right place to read profile fields.
const verifyGoogleAccessToken = async (accessToken) => {
  const expectedAud = process.env.GOOGLE_CLIENT_ID;
  if (!expectedAud) throw new Error('GOOGLE_CLIENT_ID not configured');

  // Step 1 — audience check (the security gate).
  let tokenInfo;
  try {
    const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
      params: { access_token: accessToken },
      timeout: 5000,
    });
    tokenInfo = response.data;
  } catch (err) {
    const status = err && err.response ? err.response.status : undefined;
    const body = err && err.response ? err.response.data : undefined;
    throw new Error(`tokeninfo lookup failed (status=${status}): ${JSON.stringify(body) || err.message}`);
  }

  if (tokenInfo.aud !== expectedAud && tokenInfo.azp !== expectedAud) {
    throw new Error(`Token audience mismatch: aud=${tokenInfo.aud}, azp=${tokenInfo.azp}, expected=${expectedAud}`);
  }

  // Step 2 — fetch the actual profile (email, name, picture). Required to
  // know who the user is; missing email here means the token has no email
  // scope, so we can't log them in.
  let userinfo;
  try {
    const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 5000,
    });
    userinfo = response.data;
  } catch (err) {
    const status = err && err.response ? err.response.status : undefined;
    const body = err && err.response ? err.response.data : undefined;
    throw new Error(`userinfo lookup failed (status=${status}): ${JSON.stringify(body) || err.message}`);
  }

  if (!userinfo.email) {
    throw new Error('Google account has no email — re-grant email scope on sign-in');
  }

  return {
    email: userinfo.email,
    email_verified: userinfo.email_verified !== false,
    name: userinfo.name,
    picture: userinfo.picture,
  };
};

const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'Google credential missing' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'Server misconfiguration: GOOGLE_CLIENT_ID not set' });
    }

    let payload;
    try {
      const isLikelyJwt = credential.split('.').length === 3;
      if (isLikelyJwt) {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } else {
        payload = await verifyGoogleAccessToken(credential);
      }
    } catch (e) {
      // Log full context so we can diagnose audience/scope issues from logs.
      console.warn('Google token verification failed:', e && (e.stack || e.message));
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }
    if (payload.email_verified === false) {
      return res.status(401).json({ error: 'Google account email is not verified' });
    }

    const { email, name, picture } = payload;
    const normalizedEmail = email.toLowerCase().trim();

    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    let isNewUser = false;
    let newApiKey = null;

    if (!user) {
      isNewUser = true;
      const randomPass = crypto.randomBytes(32).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(randomPass, salt);

      try {
        user = await prisma.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            name: name || normalizedEmail.split('@')[0],
            creditsBalance: FIRST_MONTH_FREE_CREDITS,
            freeCreditsRemaining: FIRST_MONTH_FREE_CREDITS,
          },
        });
      } catch (err) {
        if (err && err.code === 'P2002') {
          // Race: another request just created the same email — fetch it.
          user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
          isNewUser = false;
        } else {
          throw err;
        }
      }

      if (isNewUser) {
        newApiKey = await issueDefaultApiKey(user.id);
      }
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      message: 'Logged in with Google successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        creditsBalance: user.creditsBalance,
        addonCredits: user.addonCredits,
        freeCreditsRemaining: user.freeCreditsRemaining,
        picture,
      },
      ...(isNewUser && newApiKey ? { apiKey: newApiKey } : {}),
    });
  } catch (error) {
    // Surface stack + Prisma error code so Render logs show what actually broke.
    console.error('Google Auth error:', error && (error.stack || error.message), 'code=', error && error.code);
    res.status(500).json({ error: 'Internal server error during Google auth' });
  }
};

const updateMe = async (req, res) => {
  try {
    const { name, presets } = req.body;
    const data = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      data.name = name.trim().slice(0, 80);
    }

    if (presets !== undefined) {
      if (!Array.isArray(presets)) {
        return res.status(400).json({ error: 'Presets must be an array' });
      }
      if (presets.length > 3) {
        return res.status(400).json({ error: 'Maximum 3 presets allowed' });
      }
      data.presets = presets;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: { id: true, email: true, name: true, creditsBalance: true, addonCredits: true, freeCreditsRemaining: true, presets: true },
    });
    res.json({ user: updatedUser });
  } catch (error) {
    console.error('UpdateMe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateMe,
  googleAuth,
};
