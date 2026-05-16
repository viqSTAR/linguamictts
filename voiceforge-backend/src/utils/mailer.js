const nodemailer = require('nodemailer');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  SMTP_SECURE,
} = process.env;

let cachedTransport = null;
const getTransport = () => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587,
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cachedTransport;
};

const fromAddress = () => SMTP_FROM || SMTP_USER || 'no-reply@linguamic.com';

const renderRenewalEmail = ({ name, planKey, currentPeriodEnd, kind }) => {
  const planLabel = planKey.charAt(0) + planKey.slice(1).toLowerCase();
  const endDate = new Date(currentPeriodEnd).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  if (kind === 'renew') {
    const subject = `Heads up — your Linguamic ${planLabel} plan auto-renews in 3 days`;
    const text = [
      greeting,
      '',
      `Your Linguamic ${planLabel} plan will auto-renew on ${endDate}. Your card on file will be charged and your credits will reset for the new billing period.`,
      '',
      'If you want to make any changes (cancel auto-pay, switch plan, update payment method), do it before then from your billing dashboard:',
      'https://linguamic.com/studio',
      '',
      "If you're happy as-is, no action needed — we'll handle the rest.",
      '',
      '— Linguamic',
    ].join('\n');
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #c2410c; margin-bottom: 8px;">Your ${planLabel} plan renews in 3 days</h2>
        <p>${greeting}</p>
        <p>Your Linguamic <strong>${planLabel}</strong> plan will auto-renew on <strong>${endDate}</strong>. Your card on file will be charged and your credits will reset for the new billing period.</p>
        <p>If you want to make any changes (cancel auto-pay, switch plan, update payment method), do it before then from your <a href="https://linguamic.com/studio" style="color: #c2410c;">billing dashboard</a>.</p>
        <p>If you're happy as-is, no action needed — we'll handle the rest.</p>
        <p style="color: #6b7280; margin-top: 32px; font-size: 13px;">— Linguamic</p>
      </div>
    `;
    return { subject, text, html };
  }

  // kind === 'expire'
  const subject = `Your Linguamic ${planLabel} plan ends in 3 days`;
  const text = [
    greeting,
    '',
    `Your Linguamic ${planLabel} plan is scheduled to end on ${endDate}. After that date, your remaining credits on this plan will be cleared.`,
    '',
    'Want to keep your plan running? Re-enable auto-pay from your billing dashboard:',
    'https://linguamic.com/studio',
    '',
    "If you meant to let it end, no action needed.",
    '',
    '— Linguamic',
  ].join('\n');
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #b45309; margin-bottom: 8px;">Your ${planLabel} plan ends in 3 days</h2>
      <p>${greeting}</p>
      <p>Your Linguamic <strong>${planLabel}</strong> plan is scheduled to end on <strong>${endDate}</strong>. After that date, your remaining credits on this plan will be cleared.</p>
      <p>Want to keep your plan running? <a href="https://linguamic.com/studio" style="color: #b45309;">Re-enable auto-pay</a> any time before the end date.</p>
      <p>If you meant to let it end, no action needed.</p>
      <p style="color: #6b7280; margin-top: 32px; font-size: 13px;">— Linguamic</p>
    </div>
  `;
  return { subject, text, html };
};

// Sends a renewal/expiry notice. Returns true on success, false if SMTP is
// not configured (caller can decide to log/skip) or on transport error.
const sendRenewalNotice = async ({ to, name, planKey, currentPeriodEnd, kind }) => {
  const transport = getTransport();
  if (!transport) {
    console.warn('[mailer] SMTP not configured; skipping renewal notice for', to);
    return false;
  }
  const { subject, text, html } = renderRenewalEmail({ name, planKey, currentPeriodEnd, kind });
  try {
    await transport.sendMail({ from: fromAddress(), to, subject, text, html });
    return true;
  } catch (err) {
    console.error('[mailer] failed to send renewal notice to', to, err.message);
    return false;
  }
};

module.exports = { sendRenewalNotice };
