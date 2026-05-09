const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { ensureMonthlyCredits } = require('../utils/credits');

const verifyApiKey = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid API key' });
  }

  const rawApiKey = authHeader.split(' ')[1];
  const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');

  try {
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!apiKeyRecord || !apiKeyRecord.isActive) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or revoked API key' });
    }

    const updatedBalance = await ensureMonthlyCredits(apiKeyRecord.userId);
    if (updatedBalance !== null && updatedBalance !== undefined) {
      apiKeyRecord.user.creditsBalance = updatedBalance;
    }

    // Update lastUsedAt asynchronously
    prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    }).catch(console.error);

    req.user = apiKeyRecord.user;
    req.apiKey = apiKeyRecord;
    next();
  } catch (error) {
    console.error('API Key validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  verifyApiKey,
};
