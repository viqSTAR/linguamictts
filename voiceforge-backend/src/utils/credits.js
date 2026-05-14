const prisma = require('./prisma');

const FIRST_MONTH_FREE_CREDITS = 12000;
const FREE_MONTHLY_CREDITS = 10000;

const getMonthKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// First moment of the next calendar month in UTC. Kept for any caller that
// genuinely needs a month-aligned boundary; do NOT use this for per-subscription
// renewals — those follow the purchase anniversary (use addMonthsUtc instead).
const endOfCurrentMonthUtc = (now = new Date()) => {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
};

// Same-day-next-month in UTC, clamped to end-of-month if the day doesn't
// exist (Jan 31 → Feb 28/29). Used as the fallback for a subscription's
// next billing date so each sub keeps its purchase anniversary regardless
// of which day of the month it was bought.
const addMonthsUtc = (date, months = 1) => {
  const base = date instanceof Date ? date : new Date(date);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const d = base.getUTCDate();
  const target = new Date(Date.UTC(y, m + months, 1, base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds(), base.getUTCMilliseconds()));
  const lastOfTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastOfTargetMonth));
  return target;
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
 * reserveCredits — atomic FIFO drain across all credit sources for a user.
 *
 * Drain order:
 *   1. Free monthly bucket          (User.freeCreditsRemaining)
 *   2. Subscriptions, oldest first  (Subscription.creditsRemaining, ACTIVE/CANCELED)
 *   3. Addon top-ups, oldest first  (AddonGrant.creditsRemaining)
 *
 * The cached User.creditsBalance is the sum of all three pools and is updated
 * inside the same transaction. Returns the new balance on success, or
 * { ok: false } when the user can't afford the request.
 */
const reserveCredits = async (userId, amount) => {
  if (!amount || amount <= 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditsBalance: true },
    });
    return { ok: true, balance: user ? user.creditsBalance : 0 };
  }

  return prisma.$transaction(async (tx) => {
    // Cheap pre-check on the cached total. The walk below would also catch
    // insufficient funds, but a single read here avoids touching per-bucket
    // rows when the user has nothing.
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        creditsBalance: true,
        freeCreditsRemaining: true,
      },
    });
    if (!user || user.creditsBalance < amount) {
      return { ok: false, balance: user ? user.creditsBalance : 0 };
    }

    let remaining = amount;
    let addonDrained = 0;

    // 1. Free monthly bucket
    if (remaining > 0 && user.freeCreditsRemaining > 0) {
      const take = Math.min(remaining, user.freeCreditsRemaining);
      await tx.user.update({
        where: { id: userId },
        data: { freeCreditsRemaining: { decrement: take } },
      });
      remaining -= take;
    }

    // 2. Subscriptions in FIFO order. CANCELED subs still have credits until
    //    their period ends — they participate in the drain just like ACTIVE.
    if (remaining > 0) {
      const subs = await tx.subscription.findMany({
        where: {
          userId,
          status: { in: ['ACTIVE', 'CANCELED'] },
          creditsRemaining: { gt: 0 },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, creditsRemaining: true },
      });
      for (const sub of subs) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, sub.creditsRemaining);
        await tx.subscription.update({
          where: { id: sub.id },
          data: { creditsRemaining: { decrement: take } },
        });
        remaining -= take;
      }
    }

    // 3. Addon top-ups in FIFO order
    if (remaining > 0) {
      const grants = await tx.addonGrant.findMany({
        where: { userId, creditsRemaining: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, creditsRemaining: true },
      });
      for (const g of grants) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, g.creditsRemaining);
        await tx.addonGrant.update({
          where: { id: g.id },
          data: { creditsRemaining: { decrement: take } },
        });
        remaining -= take;
        addonDrained += take;
      }
    }

    if (remaining > 0) {
      // Cached balance said we had enough but the buckets disagree — schema
      // drift. Throw to roll back so nothing is decremented.
      throw new Error(`Credit drift: cached balance ${user.creditsBalance} but bucket sum < ${amount} for user ${userId}`);
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        creditsBalance: { decrement: amount },
        ...(addonDrained > 0 ? { addonCredits: { decrement: addonDrained } } : {}),
      },
      select: { creditsBalance: true },
    });

    return { ok: true, balance: updated.creditsBalance };
  });
};

/**
 * refundCredits — return credits to the youngest available bucket.
 *
 * Strategy: prefer the bucket with the longest remaining lifetime so the
 * user is never penalised by a reserve→refund cycle. Order:
 *   1. Youngest addon grant   (permanent — best for the user)
 *   2. Youngest active sub    (lives until next period boundary)
 *   3. Free monthly bucket    (resets next month)
 *
 * Total creditsBalance is always restored regardless of where the refund
 * lands. Failures throw — callers must handle them (no silent swallow).
 */
const refundCredits = async (userId, amount) => {
  if (!amount || amount <= 0) return;

  await prisma.$transaction(async (tx) => {
    const addon = await tx.addonGrant.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (addon) {
      await tx.addonGrant.update({
        where: { id: addon.id },
        data: { creditsRemaining: { increment: amount } },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          creditsBalance: { increment: amount },
          addonCredits: { increment: amount },
        },
      });
      return;
    }

    const sub = await tx.subscription.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'CANCELED'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (sub) {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { creditsRemaining: { increment: amount } },
      });
      await tx.user.update({
        where: { id: userId },
        data: { creditsBalance: { increment: amount } },
      });
      return;
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        freeCreditsRemaining: { increment: amount },
        creditsBalance: { increment: amount },
      },
    });
  });
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
 * ensureMonthlyCredits — runs once per calendar month per user.
 *
 * In the multi-subscription world, Dodo's webhooks own paid-plan renewals
 * (subscription.renewed grants the next month's credits). This function's
 * remaining job is:
 *   1. Reset the per-user free monthly bucket on month rollover.
 *   2. Expire any CANCELED subscription whose period has ended (Dodo's
 *      subscription.expired webhook usually handles this — we do it
 *      defensively in case that event was missed).
 *
 * Idempotent: it keys off (userId, MONTHLY_RESET, monthKey) so concurrent
 * requests in the same month no-op cleanly.
 */
const ensureMonthlyCredits = async (userId) => {
  const now = new Date();
  const monthKey = getMonthKey(now);

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.creditTransaction.findFirst({
        where: { userId, type: 'MONTHLY_RESET', referenceId: monthKey },
        select: { id: true },
      });
      if (existing) {
        const u = await tx.user.findUnique({
          where: { id: userId },
          select: { creditsBalance: true },
        });
        return u ? u.creditsBalance : null;
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          creditsBalance: true,
          freeCreditsRemaining: true,
          freeMonthKey: true,
          createdAt: true,
        },
      });
      if (!user) return null;

      let balanceDelta = 0;

      // 1. Free monthly bucket reset. First month after signup gets the
      //    bonus allowance; every month after gets the standard amount.
      const isFirstMonth =
        user.createdAt &&
        user.createdAt.getUTCFullYear() === now.getUTCFullYear() &&
        user.createdAt.getUTCMonth() === now.getUTCMonth();
      const freeAllowance = isFirstMonth ? FIRST_MONTH_FREE_CREDITS : FREE_MONTHLY_CREDITS;
      const freeDelta = freeAllowance - user.freeCreditsRemaining;
      balanceDelta += freeDelta;

      // 2. Expire CANCELED subs whose period has lapsed. Webhook usually
      //    beats us to it; this is the safety net.
      const stale = await tx.subscription.findMany({
        where: {
          userId,
          status: 'CANCELED',
          currentPeriodEnd: { lte: now },
        },
        select: { id: true, creditsRemaining: true },
      });
      for (const sub of stale) {
        balanceDelta -= sub.creditsRemaining;
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: 'EXPIRED', creditsRemaining: 0 },
        });
      }

      const newBalance = Math.max(0, user.creditsBalance + balanceDelta);
      await tx.user.update({
        where: { id: userId },
        data: {
          freeCreditsRemaining: freeAllowance,
          freeMonthKey: monthKey,
          creditsBalance: newBalance,
        },
      });

      try {
        await tx.creditTransaction.create({
          data: {
            userId,
            amount: balanceDelta,
            type: 'MONTHLY_RESET',
            description: `Monthly free reset ${monthKey} — ${freeAllowance.toLocaleString()} free credits${stale.length > 0 ? ` (expired ${stale.length} cancelled plan${stale.length > 1 ? 's' : ''})` : ''}`,
            referenceId: monthKey,
          },
        });
      } catch (logErr) {
        if (logErr && logErr.code !== 'P2002') throw logErr;
      }

      return newBalance;
    });
  } catch (error) {
    console.error('Monthly credit reset error:', error);
    return null;
  }
};

module.exports = {
  FIRST_MONTH_FREE_CREDITS,
  FREE_MONTHLY_CREDITS,
  getMonthKey,
  endOfCurrentMonthUtc,
  addMonthsUtc,
  ensureMonthlyCredits,
  VALID_ORPHEUS_EMOTIONS,
  computeTtsCredits,
  computeSttCredits,
  reserveCredits,
  refundCredits,
  logUsage,
};
