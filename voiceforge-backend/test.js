const prisma = require('./src/utils/prisma');
async function test() {
  try {
    const user = await prisma.user.findFirst();
    console.log('User:', user);
    const planKey = 'PRO';
    const config = { monthlyCredits: 850000 };
    const currentAddonCredits = user.addonCredits ?? 0;
    const currentPlanBalance = Math.max(0, user.creditsBalance - currentAddonCredits);
    const newBalance = config.monthlyCredits + currentPlanBalance + currentAddonCredits;
    const monthKey = '2026-05';
    const txRes = await prisma.$transaction(async (tx) => {
      await tx.creditTransaction.deleteMany({
        where: { userId: user.id, type: 'MONTHLY_RESET', referenceId: monthKey }
      });
      const u = await tx.user.update({
        where: { id: user.id },
        data: {
          plan: planKey,
          planMonthlyCredits: config.monthlyCredits,
          planStartedAt: new Date(),
          creditsBalance: newBalance
        }
      });
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: config.monthlyCredits,
          type: 'PLAN_UPGRADE',
          description: 'Test upgrade',
          referenceId: 'plan_test_123'
        }
      });
      return u;
    });
    console.log('Success:', txRes);
  } catch(e) {
    console.error('FAILED:', e);
  } finally {
    process.exit(0);
  }
}
test();
