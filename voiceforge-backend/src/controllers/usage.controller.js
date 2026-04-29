const prisma = require('../utils/prisma');

const getUsageAnalytics = async (req, res) => {
  try {
    const userId = req.userId;

    // Get user details for credit balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditsBalance: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Aggregate usage logs
    const aggregations = await prisma.usageLog.aggregate({
      where: { userId },
      _count: {
        id: true, // total calls
      },
      _sum: {
        charsCount: true,
        creditsDeducted: true,
        emotionTagsCount: true,
      },
    });

    res.json({
      creditsLeft: user.creditsBalance,
      totalCalls: aggregations._count.id || 0,
      totalCharsUsed: aggregations._sum.charsCount || 0,
      totalCreditsUsed: aggregations._sum.creditsDeducted || 0,
      totalEmotionTags: aggregations._sum.emotionTagsCount || 0,
    });
  } catch (error) {
    console.error('Usage Analytics Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getUsageAnalytics,
};
