// One-off sample-email sender. Sends every transactional template to a
// specified address so we can eyeball the rendered HTML and the From header.
// Run with: node scripts/send-sample-emails.js [recipient]
// Default recipient is the user that asked for previews.

require('dotenv').config();
const {
  sendPurchaseConfirmation,
  sendRenewalReceipt,
  sendTopUpConfirmation,
  sendRefundConfirmation,
  sendCancellationAck,
  sendRenewalNotice,
} = require('../src/utils/mailer');

const to = process.argv[2] || 'prasadmanthan07@gmail.com';
const name = 'Vikashdeep';
const inOneMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

(async () => {
  console.log(`Sending sample emails to ${to}...`);
  const results = await Promise.all([
    sendPurchaseConfirmation({
      to, name, planKey: 'CREATOR',
      monthlyCredits: 210000, priceUSD: 18.99,
      currentPeriodEnd: inOneMonth,
    }).then(ok => ({ kind: 'purchase', ok })),

    sendRenewalReceipt({
      to, name, planKey: 'CREATOR',
      monthlyCredits: 210000, priceUSD: 18.99,
      currentPeriodEnd: inOneMonth,
    }).then(ok => ({ kind: 'renewal-receipt', ok })),

    sendTopUpConfirmation({
      to, name, amountUSD: 10, credits: 55000, newBalance: 87234,
    }).then(ok => ({ kind: 'topup', ok })),

    sendRefundConfirmation({
      to, name, planKey: 'CREATOR',
      priceUSD: 18.99, refundId: 'ref_demo_abc123',
    }).then(ok => ({ kind: 'refund', ok })),

    sendCancellationAck({
      to, name, planKey: 'CREATOR', currentPeriodEnd: inOneMonth,
    }).then(ok => ({ kind: 'cancel-ack', ok })),

    // Bonus: the existing 3-day renewal-warning + 3-day-expiry templates so
    // the user can preview the full set of subscription comms in one shot.
    sendRenewalNotice({
      to, name, planKey: 'CREATOR',
      currentPeriodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      kind: 'renew',
    }).then(ok => ({ kind: 'renewal-3day-warning', ok })),

    sendRenewalNotice({
      to, name, planKey: 'CREATOR',
      currentPeriodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      kind: 'expire',
    }).then(ok => ({ kind: 'expiry-3day-warning', ok })),
  ]);
  console.log('Results:');
  for (const r of results) console.log(`  ${r.kind.padEnd(22)} ${r.ok ? 'OK' : 'FAILED'}`);
})().catch((e) => {
  console.error('Sample send failed:', e);
  process.exit(1);
});
