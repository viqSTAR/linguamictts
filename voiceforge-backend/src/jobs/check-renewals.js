// Daily cron entrypoint. Finds subscriptions whose currentPeriodEnd falls
// inside a 24h window centred on (now + 3 days) and emails the user a heads-up.
// Marks `lastRenewalNoticeAt` after a successful send so the next run won't
// re-notify for the same period.
//
// Run via Render cron service (render.yaml: type=cron). Locally you can also
// invoke it directly with `node src/jobs/check-renewals.js`.

require('dotenv').config();
const prisma = require('../utils/prisma');
const { sendRenewalNotice } = require('../utils/mailer');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOTICE_TARGET_DAYS = 3;
const NOTICE_WINDOW_MS = DAY_MS; // ±0.5 day around the 3-day mark

const run = async () => {
  const now = Date.now();
  const windowStart = new Date(now + NOTICE_TARGET_DAYS * DAY_MS - NOTICE_WINDOW_MS / 2);
  const windowEnd = new Date(now + NOTICE_TARGET_DAYS * DAY_MS + NOTICE_WINDOW_MS / 2);

  const subs = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'CANCELED'] },
      currentPeriodEnd: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true,
      planKey: true,
      status: true,
      autoRenew: true,
      currentPeriodEnd: true,
      lastRenewalNoticeAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  console.log(`[renewals] ${subs.length} sub(s) inside the 3-day notice window`);

  let sent = 0;
  let skipped = 0;
  for (const sub of subs) {
    const periodEndMs = new Date(sub.currentPeriodEnd).getTime();
    const lastNoticeMs = sub.lastRenewalNoticeAt ? new Date(sub.lastRenewalNoticeAt).getTime() : 0;

    // Skip if we've already notified for THIS period — i.e. the last notice
    // was sent inside the current billing cycle (after periodEnd - 1 month).
    // A simple proxy: lastNotice is within (periodEnd - 4 days) of periodEnd.
    if (lastNoticeMs && periodEndMs - lastNoticeMs < 4 * DAY_MS) {
      skipped += 1;
      continue;
    }

    if (!sub.user || !sub.user.email) {
      skipped += 1;
      continue;
    }

    const kind = sub.status === 'CANCELED' || sub.autoRenew === false ? 'expire' : 'renew';
    const ok = await sendRenewalNotice({
      to: sub.user.email,
      name: sub.user.name,
      planKey: sub.planKey,
      currentPeriodEnd: sub.currentPeriodEnd,
      kind,
    });

    if (ok) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { lastRenewalNoticeAt: new Date() },
      });
      sent += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(`[renewals] sent=${sent} skipped=${skipped}`);
};

run()
  .catch((err) => {
    console.error('[renewals] fatal error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
