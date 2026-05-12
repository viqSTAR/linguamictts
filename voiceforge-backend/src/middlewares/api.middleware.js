const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { ensureMonthlyCredits } = require('../utils/credits');

const verifyApiKey = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid API key' });
  }

  const rawApiKey = authHeader.split(' ')[1];
  if (!rawApiKey) {
    return res.status(401).json({ error: 'Unauthorized: Missing API key' });
  }
  const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');

  try {
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!apiKeyRecord || !apiKeyRecord.isActive) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or revoked API key' });
    }

    const refreshedBalance = await ensureMonthlyCredits(apiKeyRecord.userId);

    // Re-fetch the authoritative balance once. The monthly-reset path might
    // not have run (already-reset month → returns null), so prefer the live
    // value from the DB over any intermediate value.
    const freshUser = await prisma.user.findUnique({
      where: { id: apiKeyRecord.userId },
      select: { creditsBalance: true },
    });

    const balance = freshUser
      ? freshUser.creditsBalance
      : (refreshedBalance ?? apiKeyRecord.user.creditsBalance);

    req.user = { ...apiKeyRecord.user, creditsBalance: balance };
    req.apiKey = apiKeyRecord;

    // Fire-and-forget; ignore failures since this is purely informational.
    prisma.apiKey
      .update({ where: { id: apiKeyRecord.id }, data: { lastUsedAt: new Date() } })
      .catch((err) => console.error('apiKey.lastUsedAt update failed:', err.message));

    next();
  } catch (error) {
    console.error('API Key validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  verifyApiKey,
};
