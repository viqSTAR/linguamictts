const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { FIRST_MONTH_CREDITS, DEFAULT_MONTHLY_CREDITS } = require('../utils/credits');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user (starts with monthly free credits)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        creditsBalance: FIRST_MONTH_CREDITS,
        plan: 'FREE',
        planMonthlyCredits: DEFAULT_MONTHLY_CREDITS,
      },
    });

    // Create a default API key for the user upon registration
    const crypto = require('crypto');
    const rawApiKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');
    const prefix = `vf_${rawApiKey.substring(0, 4)}`;

    await prisma.apiKey.create({
      data: {
        userId: user.id,
        keyHash: keyHash,
        prefix: prefix,
        name: 'Default API Key',
      },
    });

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
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
      apiKey: rawApiKey
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
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
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Google credential missing' });

    let payload;
    try {
      const isLikelyJwt = credential.split('.').length === 3;
      if (isLikelyJwt) {
        if (!process.env.GOOGLE_CLIENT_ID) {
          return res.status(500).json({ error: 'Server misconfiguration: GOOGLE_CLIENT_ID not set' });
        }
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } else {
        const axios = require('axios');
        const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${credential}` }
        });
        payload = data;
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const { email, name, picture } = payload;

    let user = await prisma.user.findUnique({ where: { email } });
    let isNewUser = false;
    let newApiKey = null;

    if (!user) {
      isNewUser = true;
      const crypto = require('crypto');
      const randomPass = crypto.randomBytes(32).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(randomPass, salt);

      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: name || email.split('@')[0],
          creditsBalance: FIRST_MONTH_CREDITS,
          plan: 'FREE',
          planMonthlyCredits: DEFAULT_MONTHLY_CREDITS,
        },
      });

      const rawApiKey = crypto.randomBytes(32).toString('hex');
      const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');
      const prefix = `vf_${rawApiKey.substring(0, 4)}`;

      await prisma.apiKey.create({
        data: {
          userId: user.id,
          keyHash: keyHash,
          prefix: prefix,
          name: 'Default API Key',
        },
      });
      newApiKey = rawApiKey;
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
      ...(isNewUser && { apiKey: newApiKey })
    });
  } catch (error) {
    console.error('Google Auth error:', error);
    res.status(500).json({ error: 'Internal server error during Google auth' });
  }
};

const updateMe = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data: { name: name.trim() },
      select: { id: true, email: true, name: true, creditsBalance: true, addonCredits: true, plan: true, planMonthlyCredits: true },
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
