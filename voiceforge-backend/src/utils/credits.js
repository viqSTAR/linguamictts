const prisma = require('./prisma');

const FIRST_MONTH_CREDITS = 12000;
const DEFAULT_MONTHLY_CREDITS = 10000;

const getMonthKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * ensureMonthlyCredits — called on every authenticated request.
 *
 * Rules:
 *  1. Runs at most once per calendar month (idempotent via MONTHLY_RESET log).
 *  2. Addon credits (addonCredits field) are PERMANENT — never touched here.
 *  3. Monthly reset = ensure plan credits are at least planMonthlyCredits.
 *     Formula: target = planMonthlyCredits + addonCredits
 *     We only ADD the deficit — never reduce. Surplus plan credits carry forward.
 */
const ensureMonthlyCredits = async (userId) => {
  const monthKey = getMonthKey(new Date());

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Already processed this month?
      const existing = await tx.creditTransaction.findFirst({
        where: { userId, type: 'MONTHLY_RESET', referenceId: monthKey },
        select: { id: true },
      });
      if (existing) return null;

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          creditsBalance: true,
          planMonthlyCredits: true,
          addonCredits: true,
          plan: true,
          createdAt: true,
        },
      });
      if (!user) return null;

      const now = new Date();
      const isFirstMonth =
        user.createdAt &&
        user.createdAt.getUTCFullYear() === now.getUTCFullYear() &&
        user.createdAt.getUTCMonth() === now.getUTCMonth();

      const addonCredits = user.addonCredits ?? 0;

      // Plan credit allocation for this month
      let planAllocation = user.planMonthlyCredits || DEFAULT_MONTHLY_CREDITS;
      if (user.plan === 'FREE' && isFirstMonth) {
        planAllocation = FIRST_MONTH_CREDITS;
      }

      // The floor is: addon credits + plan allocation
      // We only top up to this floor — never reduce.
      // This means surplus plan credits carry forward naturally.
      const floor = planAllocation + addonCredits;
      const delta = Math.max(0, floor - user.creditsBalance);

      let updatedBalance = user.creditsBalance;

      if (delta > 0) {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { creditsBalance: { increment: delta } },
        });
        updatedBalance = updatedUser.creditsBalance;
      }

      // Log the reset (even if delta=0) to mark this month as processed
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: delta,
          type: 'MONTHLY_RESET',
          description: `Monthly plan reset ${monthKey} — ${planAllocation.toLocaleString()} plan credits + ${addonCredits.toLocaleString()} permanent add-ons`,
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
