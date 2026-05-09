const prisma = require('./prisma');

const FIRST_MONTH_CREDITS = 12000;
const DEFAULT_MONTHLY_CREDITS = 10000;

const getMonthKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const ensureMonthlyCredits = async (userId) => {
  const monthKey = getMonthKey(new Date());

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.creditTransaction.findFirst({
        where: { userId, type: 'MONTHLY_RESET', referenceId: monthKey },
        select: { id: true },
      });

      if (existing) {
        return null;
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditsBalance: true, planMonthlyCredits: true, plan: true, createdAt: true },
      });

      if (!user) {
        return null;
      }

      const now = new Date();
      const isFirstMonth = user.createdAt &&
                           user.createdAt.getUTCFullYear() === now.getUTCFullYear() &&
                           user.createdAt.getUTCMonth() === now.getUTCMonth();

      let targetCredits = user.planMonthlyCredits || DEFAULT_MONTHLY_CREDITS;

      // First-month bonus only for FREE plan
      if (user.plan === 'FREE' && isFirstMonth) {
        targetCredits = FIRST_MONTH_CREDITS;
      }

      // BUG FIX: Only TOP UP — never reduce. Preserves any top-up surplus above plan limit.
      const delta = Math.max(0, targetCredits - user.creditsBalance);
      let updatedBalance = user.creditsBalance;

      if (delta > 0) {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { creditsBalance: { increment: delta } },
        });
        updatedBalance = updatedUser.creditsBalance;
      }

      // Always log the reset so we know it was processed this month
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: delta,
          type: 'MONTHLY_RESET',
          description: `Monthly credit reset ${monthKey}`,
          referenceId: monthKey,
        },
      });

      return updatedBalance;
    });

    return result;
  } catch (error) {
    console.error('Monthly credit reset error:', error);
    return null;
  }
};

module.exports = {
  FIRST_MONTH_CREDITS,
  DEFAULT_MONTHLY_CREDITS,
  getMonthKey,
  ensureMonthlyCredits,
};
