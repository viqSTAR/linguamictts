const prisma = require('./prisma');

const FIRST_MONTH_CREDITS = 12000;
const DEFAULT_MONTHLY_CREDITS = 10000;

const getMonthKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// First moment of the next calendar month in UTC. Used as the next
// `currentPeriodEnd` when a subscription renews or is created.
const endOfCurrentMonthUtc = (now = new Date()) => {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
};

// Mirror of voiceforge-api/main.py — keep in sync
const VALID_ORPHEUS_EMOTIONS = new Set([
  'laugh', 'chuckle', 'sigh', 'cough', 'sniffle', 'groan', 'yawn', 'gasp',
]);
const EMOTION_TAG_RE = /<(\w+)>/g;

const computeTtsCredits = (rawText) => {
  const text = typeof rawText === 'string' ? rawText : '';
  let emotionCount = 0;
  EMOTION_TAG_RE.lastIndex = 0;
  let m;
  while ((m = EMOTION_TAG_RE.exec(text)) !== null) {
    if (VALID_ORPHEUS_EMOTIONS.has(m[1].toLowerCase())) emotionCount += 1;
  }
  const charCount = text.length;
  const credits = charCount + emotionCount * 5;
  return { charCount, emotionCount, credits };
};

const computeSttCredits = (durationSeconds) => {
  const safeDuration = Math.max(0, Number(durationSeconds) || 0);
  return Math.ceil(safeDuration) * 2; // 2 credits / second (single source of truth)
};

/**
 * Atomic credit reservation. Uses a conditional UPDATE so two concurrent
 * requests cannot both pass a stale balance check. Returns the new balance
 * on success, or {ok:false} if the user lacks the funds.
 */
const reserveCredits = async (userId, amount) => {
  if (!amount || amount <= 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditsBalance: true },
    });
    return { ok: true, balance: user ? user.creditsBalance : 0 };
  }

  const result = await prisma.user.updateMany({
    where: { id: userId, creditsBalance: { gte: amount } },
    data: { creditsBalance: { decrement: amount } },
  });

  if (result.count === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditsBalance: true },
    });
    return { ok: false, balance: user ? user.creditsBalance : 0 };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsBalance: true },
  });
  return { ok: true, balance: user.creditsBalance };
};

const refundCredits = async (userId, amount) => {
  if (!amount || amount <= 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: { creditsBalance: { increment: amount } },
  }).catch((err) => console.error('Refund failed:', err.message));
};

const logUsage = async ({ userId, apiKeyId, endpointType, charsCount, emotionTagsCount, toneUsed, creditsDeducted }) => {
  try {
    await prisma.usageLog.create({
      data: {
        userId,
        apiKeyId: apiKeyId || null,
        endpointType,
        charsCount: charsCount ?? null,
        emotionTagsCount: emotionTagsCount ?? null,
        toneUsed: toneUsed ?? null,
        creditsDeducted: creditsDeducted || 0,
      },
    });
  } catch (err) {
    console.error('Usage log failed:', err.message);
  }
};

/**
 * ensureMonthlyCredits — called on every authenticated request.
 *
 * Rules:
 *  1. Runs at most once per calendar month (idempotent via MONTHLY_RESET log).
 *  2. Addon credits (addonCredits field) are PERMANENT — never touched here.
 *  3. Monthly reset = set plan credits to the monthly allocation.
 *     Formula: target = planMonthlyCredits + addonCredits
 *     Add-on credits are permanent. Plan credits do not carry forward.
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
          subscriptionStatus: true,
          currentPeriodEnd: true,
          autoRenew: true,
        },
      });
      if (!user) return null;

      const now = new Date();
      const isFirstMonth =
        user.createdAt &&
        user.createdAt.getUTCFullYear() === now.getUTCFullYear() &&
        user.createdAt.getUTCMonth() === now.getUTCMonth();

      const addonCredits = user.addonCredits ?? 0;

      // ── Subscription lifecycle on month rollover ──────────────────────────
      // If the user is on a paid plan and the period has ended:
      //   • autoRenew=true   → renew the subscription (extend currentPeriodEnd)
      //   • autoRenew=false  → downgrade to FREE (plan credits reset to free tier)
      // FREE users skip this branch entirely.
      const periodOver = user.currentPeriodEnd && user.currentPeriodEnd <= now;
      const isPaidPlan = user.plan && user.plan !== 'FREE';

      let effectivePlan = user.plan;
      let effectivePlanAllocation = user.planMonthlyCredits || DEFAULT_MONTHLY_CREDITS;
      const subscriptionUpdate = {};

      if (isPaidPlan && periodOver) {
        if (user.autoRenew && user.subscriptionStatus === 'ACTIVE') {
          // Auto-renew: keep plan, push period end by one calendar month.
          // In dummy/mock mode this is free; once Dodo lands, this is where
          // the renewal charge would happen (and on failure we'd downgrade).
          subscriptionUpdate.currentPeriodEnd = endOfCurrentMonthUtc(now);
        } else {
          // Subscription was cancelled or auto-pay was off — downgrade now.
          effectivePlan = 'FREE';
          effectivePlanAllocation = DEFAULT_MONTHLY_CREDITS;
          subscriptionUpdate.plan = 'FREE';
          subscriptionUpdate.planMonthlyCredits = DEFAULT_MONTHLY_CREDITS;
          subscriptionUpdate.subscriptionStatus = 'NONE';
          subscriptionUpdate.autoRenew = false;
          subscriptionUpdate.currentPeriodEnd = null;
        }
      }

      // Plan credit allocation for this month
      let planAllocation = effectivePlanAllocation;
      if (effectivePlan === 'FREE' && isFirstMonth) {
        planAllocation = FIRST_MONTH_CREDITS;
      }

      // Reset plan credits to the monthly allocation, preserving add-on credits.
      const targetBalance = planAllocation + addonCredits;
      const delta = targetBalance - user.creditsBalance;

      let updatedBalance = user.creditsBalance;

      const userUpdateData = { ...subscriptionUpdate };
      if (delta !== 0) {
        userUpdateData.creditsBalance = targetBalance;
      }
      if (Object.keys(userUpdateData).length > 0) {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: userUpdateData,
        });
        updatedBalance = updatedUser.creditsBalance;
      }

      // Log the reset (even if delta=0) to mark this month as processed.
      // Wrap in try/catch so a race between two requests doesn't 500 — the
      // (userId, type, referenceId) unique constraint guarantees exactly one
      // reset per month.
      try {
        await tx.creditTransaction.create({
          data: {
            userId,
            amount: delta,
            type: 'MONTHLY_RESET',
            description: `Monthly plan reset ${monthKey} — ${planAllocation.toLocaleString()} plan credits + ${addonCredits.toLocaleString()} permanent add-ons${subscriptionUpdate.plan === 'FREE' ? ' (subscription cancelled, downgraded to FREE)' : ''}`,
            referenceId: monthKey,
          },
        });
      } catch (logErr) {
        if (logErr && logErr.code !== 'P2002') throw logErr;
      }

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
  endOfCurrentMonthUtc,
  ensureMonthlyCredits,
  VALID_ORPHEUS_EMOTIONS,
  computeTtsCredits,
  computeSttCredits,
  reserveCredits,
  refundCredits,
  logUsage,
};
