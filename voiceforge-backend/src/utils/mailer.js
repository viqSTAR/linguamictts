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

const fromAddress = () => SMTP_FROM || SMTP_USER || 'company@linguamic.com';

const renderRenewalEmail = ({ name, planKey, currentPeriodEnd, kind }) => {
  const planLabel = planKey.charAt(0) + planKey.slice(1).toLowerCase();
  const endDate = new Date(currentPeriodEnd).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  if (kind === 'renew') {
    const subject = `Heads up — your LinguaMic ${planLabel} plan auto-renews in 3 days`;
    const text = [
      greeting,
      '',
      `Your LinguaMic ${planLabel} plan will auto-renew on ${endDate}. Your card on file will be charged and your credits will reset for the new billing period.`,
      '',
      'If you want to make any changes (cancel auto-pay, switch plan, update payment method), do it before then from your billing dashboard:',
      'https://linguamic.com/pricing',
      '',
      "If you're happy as-is, no action needed — we'll handle the rest.",
      '',
      '— LinguaMic',
    ].join('\n');
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #c2410c; margin-bottom: 8px;">Your ${planLabel} plan renews in 3 days</h2>
        <p>${greeting}</p>
        <p>Your LinguaMic <strong>${planLabel}</strong> plan will auto-renew on <strong>${endDate}</strong>. Your card on file will be charged and your credits will reset for the new billing period.</p>
        <p>If you want to make any changes (cancel auto-pay, switch plan, update payment method), do it before then from your <a href="https://linguamic.com/pricing" style="color: #c2410c;">billing dashboard</a>.</p>
        <p>If you're happy as-is, no action needed — we'll handle the rest.</p>
        <p style="color: #6b7280; margin-top: 32px; font-size: 13px;">— LinguaMic</p>
      </div>
    `;
    return { subject, text, html };
  }

  // kind === 'expire'
  const subject = `Your LinguaMic ${planLabel} plan ends in 3 days`;
  const text = [
    greeting,
    '',
    `Your LinguaMic ${planLabel} plan is scheduled to end on ${endDate}. After that date, your remaining credits on this plan will be cleared.`,
    '',
    'Want to keep your plan running? Re-enable auto-pay from your billing dashboard:',
    'https://linguamic.com/pricing',
    '',
    "If you meant to let it end, no action needed.",
    '',
    '— LinguaMic',
  ].join('\n');
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #b45309; margin-bottom: 8px;">Your ${planLabel} plan ends in 3 days</h2>
      <p>${greeting}</p>
      <p>Your LinguaMic <strong>${planLabel}</strong> plan is scheduled to end on <strong>${endDate}</strong>. After that date, your remaining credits on this plan will be cleared.</p>
      <p>Want to keep your plan running? <a href="https://linguamic.com/pricing" style="color: #b45309;">Re-enable auto-pay</a> any time before the end date.</p>
      <p>If you meant to let it end, no action needed.</p>
      <p style="color: #6b7280; margin-top: 32px; font-size: 13px;">— LinguaMic</p>
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

// ─── Subscription purchase / activation confirmation ─────────────────────────
// Sent right after a Dodo `subscription.active` webhook lands and we've
// granted the user their credits. Acts as the user's receipt — confirms the
// plan, credits, amount charged, and next renewal date.
const renderPurchaseEmail = ({ name, planKey, monthlyCredits, priceUSD, currentPeriodEnd }) => {
  const planLabel = planKey.charAt(0) + planKey.slice(1).toLowerCase();
  const renewDate = new Date(currentPeriodEnd).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const amount = typeof priceUSD === 'number' ? `$${priceUSD.toFixed(2)}` : 'your card on file';
  const credits = (monthlyCredits || 0).toLocaleString();

  const subject = `Welcome to LinguaMic — your ${planLabel} plan is active`;
  const text = [
    greeting,
    '',
    `Thanks for subscribing to LinguaMic ${planLabel}. Your plan is active and the credits are already in your account.`,
    '',
    'Order summary',
    `  Plan:     ${planLabel}`,
    `  Credits:  ${credits} per month`,
    `  Amount:   ${amount}`,
    `  Renews:   ${renewDate}`,
    '',
    'Start creating: https://linguamic.com/studio',
    'Manage plan or auto-pay: https://linguamic.com/pricing',
    '',
    'Need a refund? If this is your first paid plan and you have used fewer than 5,000 credits, an automatic refund is available from your pricing dashboard within 24 hours of purchase. See https://linguamic.com/terms for the full policy.',
    '',
    'Reply to this email if anything looks wrong — we read every message.',
    '',
    '— LinguaMic',
  ].join('\n');
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #c2410c; margin-bottom: 8px;">Welcome to LinguaMic ${planLabel}</h2>
      <p>${greeting}</p>
      <p>Thanks for subscribing. Your plan is active and the credits are already in your account.</p>

      <table style="width: 100%; margin: 18px 0; border-collapse: collapse; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px;">
        <tbody>
          <tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px;">Plan</td><td style="padding: 10px 16px; text-align: right; font-weight: 600;">${planLabel}</td></tr>
          <tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px; border-top: 1px solid #fed7aa;">Credits</td><td style="padding: 10px 16px; text-align: right; font-weight: 600; border-top: 1px solid #fed7aa;">${credits} / month</td></tr>
          <tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px; border-top: 1px solid #fed7aa;">Amount charged</td><td style="padding: 10px 16px; text-align: right; font-weight: 600; border-top: 1px solid #fed7aa;">${amount}</td></tr>
          <tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px; border-top: 1px solid #fed7aa;">Renews on</td><td style="padding: 10px 16px; text-align: right; font-weight: 600; border-top: 1px solid #fed7aa;">${renewDate}</td></tr>
        </tbody>
      </table>

      <p style="margin: 22px 0;">
        <a href="https://linguamic.com/studio" style="display: inline-block; background: #111827; color: #fff; padding: 10px 18px; border-radius: 999px; text-decoration: none; font-weight: 600; margin-right: 8px;">Open Studio</a>
        <a href="https://linguamic.com/pricing" style="display: inline-block; background: #fff; color: #111827; padding: 10px 18px; border-radius: 999px; text-decoration: none; font-weight: 600; border: 1px solid #e5e7eb;">Manage plan</a>
      </p>

      <p style="font-size: 13px; color: #6b7280; line-height: 1.55;">
        <strong>Changed your mind?</strong> If this is your first paid plan and you have used fewer than 5,000 credits, an automatic refund is available from your <a href="https://linguamic.com/pricing" style="color: #c2410c;">pricing dashboard</a> within 24 hours of purchase. Full policy: <a href="https://linguamic.com/terms" style="color: #c2410c;">linguamic.com/terms</a>.
      </p>

      <p style="font-size: 13px; color: #6b7280;">Reply to this email if anything looks wrong — we read every message.</p>
      <p style="color: #6b7280; margin-top: 32px; font-size: 13px;">— LinguaMic</p>
    </div>
  `;
  return { subject, text, html };
};

const sendPurchaseConfirmation = async ({ to, name, planKey, monthlyCredits, priceUSD, currentPeriodEnd }) => {
  const transport = getTransport();
  if (!transport) {
    console.warn('[mailer] SMTP not configured; skipping purchase confirmation for', to);
    return false;
  }
  const { subject, text, html } = renderPurchaseEmail({ name, planKey, monthlyCredits, priceUSD, currentPeriodEnd });
  try {
    await transport.sendMail({ from: fromAddress(), to, subject, text, html });
    return true;
  } catch (err) {
    console.error('[mailer] failed to send purchase confirmation to', to, err.message);
    return false;
  }
};

// ─── Refund confirmation ─────────────────────────────────────────────────────
// Sent after the trial-window refund flow has successfully reversed a charge.
// The Dodo refund itself settles in 5–10 business days; this is the immediate
// receipt the user gets the moment we kick that off.
const renderRefundEmail = ({ name, planKey, priceUSD, refundId }) => {
  const planLabel = planKey.charAt(0) + planKey.slice(1).toLowerCase();
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const amount = typeof priceUSD === 'number' ? `$${priceUSD.toFixed(2)}` : 'the original amount';

  const subject = `Refund issued for your LinguaMic ${planLabel} plan`;
  const text = [
    greeting,
    '',
    `We have issued a full refund of ${amount} for your LinguaMic ${planLabel} plan.`,
    '',
    'The refund typically settles in your account within 5–10 business days, depending on your bank.',
    `Refund reference: ${refundId || '(pending)'}`,
    '',
    'Your subscription has ended immediately and any unused credits from that plan have been reversed.',
    '',
    'If you change your mind, you can subscribe again any time from https://linguamic.com/pricing.',
    '',
    '— LinguaMic',
  ].join('\n');
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #b45309; margin-bottom: 8px;">Refund issued for your ${planLabel} plan</h2>
      <p>${greeting}</p>
      <p>We have issued a full refund of <strong>${amount}</strong> for your LinguaMic <strong>${planLabel}</strong> plan.</p>

      <table style="width: 100%; margin: 18px 0; border-collapse: collapse; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px;">
        <tbody>
          <tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px;">Plan refunded</td><td style="padding: 10px 16px; text-align: right; font-weight: 600;">${planLabel}</td></tr>
          <tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px; border-top: 1px solid #fde68a;">Amount</td><td style="padding: 10px 16px; text-align: right; font-weight: 600; border-top: 1px solid #fde68a;">${amount}</td></tr>
          <tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px; border-top: 1px solid #fde68a;">Reference</td><td style="padding: 10px 16px; text-align: right; font-weight: 600; border-top: 1px solid #fde68a; font-family: monospace; font-size: 12px;">${refundId || '(pending)'}</td></tr>
          <tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px; border-top: 1px solid #fde68a;">Settles in</td><td style="padding: 10px 16px; text-align: right; font-weight: 600; border-top: 1px solid #fde68a;">5–10 business days</td></tr>
        </tbody>
      </table>

      <p>Your subscription has ended immediately and any unused credits from that plan have been reversed.</p>
      <p style="font-size: 13px; color: #6b7280;">If you change your mind, you can subscribe again any time from your <a href="https://linguamic.com/pricing" style="color: #b45309;">pricing page</a>.</p>
      <p style="color: #6b7280; margin-top: 32px; font-size: 13px;">— LinguaMic</p>
    </div>
  `;
  return { subject, text, html };
};

const sendRefundConfirmation = async ({ to, name, planKey, priceUSD, refundId }) => {
  const transport = getTransport();
  if (!transport) {
    console.warn('[mailer] SMTP not configured; skipping refund confirmation for', to);
    return false;
  }
  const { subject, text, html } = renderRefundEmail({ name, planKey, priceUSD, refundId });
  try {
    await transport.sendMail({ from: fromAddress(), to, subject, text, html });
    return true;
  } catch (err) {
    console.error('[mailer] failed to send refund confirmation to', to, err.message);
    return false;
  }
};

// ─── Renewal receipt ─────────────────────────────────────────────────────────
// Sent right after Dodo charges a recurring monthly renewal. Distinct from
// `sendRenewalNotice` which is the 3-day-before heads-up. This is the receipt.
const renderRenewalReceiptEmail = ({ name, planKey, monthlyCredits, priceUSD, currentPeriodEnd }) => {
  const planLabel = planKey.charAt(0) + planKey.slice(1).toLowerCase();
  const renewDate = new Date(currentPeriodEnd).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const amount = typeof priceUSD === 'number' ? `$${priceUSD.toFixed(2)}` : 'your card on file';
  const credits = (monthlyCredits || 0).toLocaleString();

  const subject = `Your LinguaMic ${planLabel} plan has renewed`;
  const text = [
    greeting,
    '',
    `Your LinguaMic ${planLabel} plan renewed today and ${credits} fresh credits have been added to your account.`,
    '',
    'Renewal summary',
    `  Plan:          ${planLabel}`,
    `  Credits added: ${credits}`,
    `  Amount:        ${amount}`,
    `  Next renewal:  ${renewDate}`,
    '',
    'Manage plan or auto-pay: https://linguamic.com/pricing',
    '',
    '— LinguaMic',
  ].join('\n');
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #c2410c; margin-bottom: 8px;">Your ${planLabel} plan has renewed</h2>
      <p>${greeting}</p>
      <p>Your LinguaMic <strong>${planLabel}</strong> plan renewed today and <strong>${credits} credits</strong> have been added to your account.</p>

      <table style="width: 100%; margin: 18px 0; border-collapse: collapse; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px;">
        <tbody>
          <tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px;">Plan</td><td style="padding: 10px 16px; text-align: right; font-weight: 600;">${planLabel}</td></tr>
          <tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px; border-top: 1px solid #fed7aa;">Credits added</td><td style="padding: 10px 16px; text-align: right; font-weight: 600; border-top: 1px solid #fed7aa;">${credits}</td></tr>
          <tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px; border-top: 1px solid #fed7aa;">Amount charged</td><td style="padding: 10px 16px; text-align: right; font-weight: 600; border-top: 1px solid #fed7aa;">${amount}</td></tr>
          <tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px; border-top: 1px solid #fed7aa;">Next renewal</td><td style="padding: 10px 16px; text-align: right; font-weight: 600; border-top: 1px solid #fed7aa;">${renewDate}</td></tr>
        </tbody>
      </table>

      <p style="margin: 22px 0;">
        <a href="https://linguamic.com/pricing" style="display: inline-block; background: #111827; color: #fff; padding: 10px 18px; border-radius: 999px; text-decoration: none; font-weight: 600;">Manage plan</a>
      </p>
      <p style="color: #6b7280; margin-top: 32px; font-size: 13px;">— LinguaMic</p>
    </div>
  `;
  return { subject, text, html };
};

const sendRenewalReceipt = async ({ to, name, planKey, monthlyCredits, priceUSD, currentPeriodEnd }) => {
  const transport = getTransport();
  if (!transport) {
    console.warn('[mailer] SMTP not configured; skipping renewal receipt for', to);
    return false;
  }
  const { subject, text, html } = renderRenewalReceiptEmail({ name, planKey, monthlyCredits, priceUSD, currentPeriodEnd });
  try {
    await transport.sendMail({ from: fromAddress(), to, subject, text, html });
    return true;
  } catch (err) {
    console.error('[mailer] failed to send renewal receipt to', to, err.message);
    return false;
  }
};

// ─── Top-up receipt ──────────────────────────────────────────────────────────
// Fires after a successful one-time top-up payment (the $1 / $5 / $10 tiers).
// These credits never expire so the receipt highlights that.
const renderTopUpEmail = ({ name, amountUSD, credits, newBalance }) => {
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const amount = typeof amountUSD === 'number' ? `$${amountUSD.toFixed(2)}` : 'your purchase';
  const creditsAdded = (credits || 0).toLocaleString();
  const balance = typeof newBalance === 'number' ? newBalance.toLocaleString() : null;

  const subject = `LinguaMic top-up confirmed — ${creditsAdded} credits added`;
  const text = [
    greeting,
    '',
    `Your ${amount} top-up landed and ${creditsAdded} credits have been added to your account.`,
    '',
    'Top-up summary',
    `  Amount:        ${amount}`,
    `  Credits added: ${creditsAdded}`,
    balance ? `  New balance:   ${balance}` : null,
    '',
    'These credits are permanent — they never expire and carry over indefinitely.',
    '',
    'Start using them: https://linguamic.com/studio',
    '',
    '— LinguaMic',
  ].filter(Boolean).join('\n');
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #c2410c; margin-bottom: 8px;">${creditsAdded} credits added to your account</h2>
      <p>${greeting}</p>
      <p>Your <strong>${amount}</strong> top-up landed and <strong>${creditsAdded} credits</strong> are now available.</p>

      <table style="width: 100%; margin: 18px 0; border-collapse: collapse; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px;">
        <tbody>
          <tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px;">Amount paid</td><td style="padding: 10px 16px; text-align: right; font-weight: 600;">${amount}</td></tr>
          <tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px; border-top: 1px solid #fed7aa;">Credits added</td><td style="padding: 10px 16px; text-align: right; font-weight: 600; border-top: 1px solid #fed7aa;">${creditsAdded}</td></tr>
          ${balance ? `<tr><td style="padding: 10px 16px; color: #6b7280; font-size: 13px; border-top: 1px solid #fed7aa;">New balance</td><td style="padding: 10px 16px; text-align: right; font-weight: 600; border-top: 1px solid #fed7aa;">${balance}</td></tr>` : ''}
        </tbody>
      </table>

      <p style="font-size: 13px; color: #6b7280;">These credits are <strong>permanent</strong> — they never expire and carry over indefinitely.</p>

      <p style="margin: 22px 0;">
        <a href="https://linguamic.com/studio" style="display: inline-block; background: #111827; color: #fff; padding: 10px 18px; border-radius: 999px; text-decoration: none; font-weight: 600;">Open Studio</a>
      </p>
      <p style="color: #6b7280; margin-top: 32px; font-size: 13px;">— LinguaMic</p>
    </div>
  `;
  return { subject, text, html };
};

const sendTopUpConfirmation = async ({ to, name, amountUSD, credits, newBalance }) => {
  const transport = getTransport();
  if (!transport) {
    console.warn('[mailer] SMTP not configured; skipping top-up confirmation for', to);
    return false;
  }
  const { subject, text, html } = renderTopUpEmail({ name, amountUSD, credits, newBalance });
  try {
    await transport.sendMail({ from: fromAddress(), to, subject, text, html });
    return true;
  } catch (err) {
    console.error('[mailer] failed to send top-up confirmation to', to, err.message);
    return false;
  }
};

// ─── Cancellation acknowledgement ────────────────────────────────────────────
// Sent when the user cancels (or disables auto-pay on) a subscription via our
// UI. The subscription remains active until `currentPeriodEnd`; this email
// confirms that and reminds them how to resume before then.
const renderCancellationEmail = ({ name, planKey, currentPeriodEnd }) => {
  const planLabel = planKey.charAt(0) + planKey.slice(1).toLowerCase();
  const endDate = new Date(currentPeriodEnd).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  const subject = `Your LinguaMic ${planLabel} plan will end on ${new Date(currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const text = [
    greeting,
    '',
    `We've cancelled the auto-pay on your LinguaMic ${planLabel} plan as you requested.`,
    '',
    `What happens next:`,
    `  • Your plan stays active until ${endDate}.`,
    `  • You keep access to your remaining credits until then.`,
    `  • No further charges will be made.`,
    `  • After that date the plan expires and any unused credits from it are cleared.`,
    '',
    `Changed your mind? Re-enable auto-pay any time before ${endDate} from https://linguamic.com/pricing.`,
    '',
    'Mind sharing why you cancelled? Just reply to this email — a real person reads every response and your feedback genuinely shapes what we build next.',
    '',
    '— LinguaMic',
  ].join('\n');
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #6b7280; margin-bottom: 8px;">Your ${planLabel} plan will end on ${endDate}</h2>
      <p>${greeting}</p>
      <p>We&apos;ve cancelled the auto-pay on your LinguaMic <strong>${planLabel}</strong> plan as you requested.</p>

      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 20px; margin: 18px 0;">
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">What happens next</p>
        <ul style="margin: 0; padding-left: 18px; color: #1f2937; font-size: 14px; line-height: 1.7;">
          <li>Your plan stays active until <strong>${endDate}</strong>.</li>
          <li>You keep access to your remaining credits until then.</li>
          <li>No further charges will be made.</li>
          <li>After that date the plan expires and any unused credits from it are cleared.</li>
        </ul>
      </div>

      <p style="margin: 22px 0;">
        <a href="https://linguamic.com/pricing" style="display: inline-block; background: #c2410c; color: #fff; padding: 10px 18px; border-radius: 999px; text-decoration: none; font-weight: 600;">Re-enable auto-pay</a>
      </p>

      <p style="font-size: 13px; color: #6b7280;">Mind sharing why you cancelled? Just reply to this email — a real person reads every response and your feedback genuinely shapes what we build next.</p>
      <p style="color: #6b7280; margin-top: 32px; font-size: 13px;">— LinguaMic</p>
    </div>
  `;
  return { subject, text, html };
};

const sendCancellationAck = async ({ to, name, planKey, currentPeriodEnd }) => {
  const transport = getTransport();
  if (!transport) {
    console.warn('[mailer] SMTP not configured; skipping cancellation ack for', to);
    return false;
  }
  const { subject, text, html } = renderCancellationEmail({ name, planKey, currentPeriodEnd });
  try {
    await transport.sendMail({ from: fromAddress(), to, subject, text, html });
    return true;
  } catch (err) {
    console.error('[mailer] failed to send cancellation ack to', to, err.message);
    return false;
  }
};

// ─── Password reset ──────────────────────────────────────────────────────────
const renderPasswordResetEmail = ({ name, code }) => {
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const subject = `Your LinguaMic password reset code: ${code}`;
  
  const text = [
    greeting,
    '',
    `We received a request to reset your password. Your 6-digit verification code is:`,
    '',
    `    ${code}`,
    '',
    `Enter this code in the app to set a new password. It will expire in 30 minutes.`,
    '',
    `If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.`,
    '',
    '— LinguaMic',
  ].join('\n');
  
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #c2410c; margin-bottom: 8px;">Reset your password</h2>
      <p>${greeting}</p>
      <p>We received a request to reset your password. Your 6-digit verification code is:</p>
      
      <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 0.2em; color: #111827;">${code}</span>
      </div>

      <p>Enter this code in the app to set a new password. It will expire in 30 minutes.</p>
      <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.</p>
      <p style="color: #6b7280; margin-top: 32px; font-size: 13px;">— LinguaMic</p>
    </div>
  `;
  return { subject, text, html };
};

const sendPasswordResetCode = async ({ to, name, code }) => {
  const transport = getTransport();
  if (!transport) {
    console.warn('[mailer] SMTP not configured; skipping password reset email for', to);
    // Even if no email is sent, return true in dev so the UI can proceed
    return true; 
  }
  const { subject, text, html } = renderPasswordResetEmail({ name, code });
  try {
    await transport.sendMail({ from: fromAddress(), to, subject, text, html });
    return true;
  } catch (err) {
    console.error('[mailer] failed to send password reset code to', to, err.message);
    return false;
  }
};

module.exports = {
  sendRenewalNotice,
  sendPurchaseConfirmation,
  sendRefundConfirmation,
  sendRenewalReceipt,
  sendTopUpConfirmation,
  sendCancellationAck,
  sendPasswordResetCode,
};
