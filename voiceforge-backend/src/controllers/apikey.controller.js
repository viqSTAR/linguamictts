const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../utils/prisma');

const listKeys = async (req, res) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.userId, isActive: true },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
    res.json({ keys });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createKey = async (req, res) => {
  try {
    const { name } = req.body;
    
    // Check key limit (e.g. max 5 keys)
    const count = await prisma.apiKey.count({
      where: { userId: req.userId, isActive: true }
    });
    
    if (count >= 5) {
      return res.status(400).json({ error: 'Maximum API key limit reached (5)' });
    }

    const rawApiKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');
    const prefix = `vf_${rawApiKey.substring(0, 4)}`;

    const newKey = await prisma.apiKey.create({
      data: {
        userId: req.userId,
        keyHash: keyHash,
        prefix: prefix,
        name: name || 'New API Key',
      },
    });

    res.status(201).json({
      message: 'API Key created successfully',
      key: {
        id: newKey.id,
        name: newKey.name,
        prefix: newKey.prefix,
        createdAt: newKey.createdAt,
      },
      rawApiKey, // ONLY shown once!
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const revokeKey = async (req, res) => {
  try {
    const { keyId } = req.params;
    
    const key = await prisma.apiKey.findFirst({
      where: { id: keyId, userId: req.userId },
    });

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  listKeys,
  createKey,
  revokeKey,
};
