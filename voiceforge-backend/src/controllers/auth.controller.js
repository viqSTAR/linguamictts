const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const prisma = require('../utils/prisma');
const { FIRST_MONTH_CREDITS, DEFAULT_MONTHLY_CREDITS } = require('../utils/credits');
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
          creditsBalance: FIRST_MONTH_CREDITS,
          plan: 'FREE',
          planMonthlyCredits: DEFAULT_MONTHLY_CREDITS,
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
        plan: user.plan,
        planMonthlyCredits: user.planMonthlyCredits,
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
        plan: user.plan,
        planMonthlyCredits: user.planMonthlyCredits,
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
        plan: true,
        planMonthlyCredits: true,
        createdAt: true,
        lastAudioUrl: true,
        lastAudioMp3Url: true,
        lastAudioUpdatedAt: true,
        presets: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        autoRenew: true,
        canceledAt: true,
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

// Verify a Google access token against tokeninfo so we know the audience
// (issued for OUR client_id) and the email is verified. Without this, any
// access token from any Google client could log in here.
const verifyGoogleAccessToken = async (accessToken) => {
  const { data } = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
    params: { access_token: accessToken },
    timeout: 5000,
  });
  const expectedAud = process.env.GOOGLE_CLIENT_ID;
  if (!expectedAud) throw new Error('GOOGLE_CLIENT_ID not configured');
  if (data.aud !== expectedAud && data.azp !== expectedAud) {
    throw new Error('Token audience mismatch');
  }
  if (!data.email) {
    throw new Error('Token has no email scope');
  }

  // tokeninfo doesn't always return email_verified; fall back to userinfo for profile.
  const userinfo = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 5000,
  }).then(r => r.data).catch(() => ({}));

  return {
    email: data.email,
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
      console.warn('Google token verification failed:', e.message);
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
            creditsBalance: FIRST_MONTH_CREDITS,
            plan: 'FREE',
            planMonthlyCredits: DEFAULT_MONTHLY_CREDITS,
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
        plan: user.plan,
        planMonthlyCredits: user.planMonthlyCredits,
        picture,
      },
      ...(isNewUser && newApiKey ? { apiKey: newApiKey } : {}),
    });
  } catch (error) {
    console.error('Google Auth error:', error);
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
      select: { id: true, email: true, name: true, creditsBalance: true, addonCredits: true, plan: true, planMonthlyCredits: true, presets: true },
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
