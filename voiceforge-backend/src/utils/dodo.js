// Dodo Payments helper. All Dodo SDK access goes through this module so the
// rest of the codebase doesn't import the SDK directly and the env-var-gated
// fallback (dummy mode) stays simple.
//
// Activation rule:
//   DODO_ENABLED=true AND DODO_API_KEY set → live Dodo path
//   anything else                          → dummy/mock path (no charges)
//
// The dummy path is intentionally preserved as a safety net during rollout.
// Once Dodo has been verified end-to-end in test mode, flip DODO_ENABLED=true
// and the existing billing routes start hitting Dodo instead.

const DodoPaymentsModule = require('dodopayments');
const DodoPayments = DodoPaymentsModule.default || DodoPaymentsModule.DodoPayments;

// ── Client (lazy-initialized) ────────────────────────────────────────────────
let _client = null;
const getClient = () => {
  if (_client) return _client;
  if (!process.env.DODO_API_KEY) {
    throw new Error('DODO_API_KEY is not set — cannot initialize Dodo client');
  }
  _client = new DodoPayments({
    bearerToken: process.env.DODO_API_KEY,
    // Default to test_mode if unset so we never accidentally hit live.
    environment: process.env.DODO_ENV === 'live_mode' ? 'live_mode' : 'test_mode',
  });
  return _client;
};

const isEnabled = () =>
  process.env.DODO_ENABLED === 'true' && !!process.env.DODO_API_KEY;

// ── Product ID lookup ────────────────────────────────────────────────────────
// Keys must match billing.controller's PLAN_CONFIG and TOPUP_CONFIG.
const PLAN_PRODUCT = {
  STARTER: () => process.env.DODO_PRODUCT_STARTER,
  CREATOR: () => process.env.DODO_PRODUCT_CREATOR,
  PRO:     () => process.env.DODO_PRODUCT_PRO,
};

const TOPUP_PRODUCT_BY_USD = {
  1:  () => process.env.DODO_PRODUCT_TOPUP_1,
  5:  () => process.env.DODO_PRODUCT_TOPUP_5,
  10: () => process.env.DODO_PRODUCT_TOPUP_10,
};

const getPlanProductId = (planKey) => {
  const getter = PLAN_PRODUCT[planKey];
  const id = getter ? getter() : null;
  if (!id) throw new Error(`No Dodo product configured for plan ${planKey}`);
  return id;
};

const getTopUpProductId = (amountUSD) => {
  const getter = TOPUP_PRODUCT_BY_USD[amountUSD];
  const id = getter ? getter() : null;
  if (!id) throw new Error(`No Dodo product configured for $${amountUSD} top-up`);
  return id;
};

// Inverse map for webhook handlers: product_id → plan key / topup USD.
// Built lazily so env changes during dev don't require a restart.
const lookupPlanByProductId = (productId) => {
  for (const key of Object.keys(PLAN_PRODUCT)) {
    if (PLAN_PRODUCT[key]() === productId) return key;
  }
  return null;
};

const lookupTopUpUsdByProductId = (productId) => {
  for (const usd of Object.keys(TOPUP_PRODUCT_BY_USD)) {
    if (TOPUP_PRODUCT_BY_USD[usd]() === productId) return Number(usd);
  }
  return null;
};

// ── Checkout session creation ────────────────────────────────────────────────
// We attach `metadata.userId` so the webhook can map incoming events back to
// our DB without trusting the customer email. We also attach `metadata.kind`
// (plan|topup) and `metadata.planKey` or `metadata.amountUSD` as a sanity
// fallback in case product_id lookup fails.
const buildReturnUrl = (kind) => {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${base}/billing/return?kind=${encodeURIComponent(kind)}`;
};

const createTopUpCheckout = async ({ userId, email, name, amountUSD, dodoCustomerId }) => {
  const client = getClient();
  const productId = getTopUpProductId(amountUSD);

  const params = {
    product_cart: [{ product_id: productId, quantity: 1 }],
    metadata: {
      userId: String(userId),
      kind: 'topup',
      amountUSD: String(amountUSD),
    },
    return_url: buildReturnUrl('topup'),
    customer: dodoCustomerId
      ? { customer_id: dodoCustomerId }
      : { email, name: name || email },
  };

  const session = await client.checkoutSessions.create(params);
  return {
    sessionId: session.session_id,
    checkoutUrl: session.checkout_url,
  };
};

const createPlanCheckout = async ({ userId, email, name, planKey, dodoCustomerId }) => {
  const client = getClient();
  const productId = getPlanProductId(planKey);

  const params = {
    product_cart: [{ product_id: productId, quantity: 1 }],
    metadata: {
      userId: String(userId),
      kind: 'plan',
      planKey,
    },
    return_url: buildReturnUrl('plan'),
    customer: dodoCustomerId
      ? { customer_id: dodoCustomerId }
      : { email, name: name || email },
  };

  const session = await client.checkoutSessions.create(params);
  return {
    sessionId: session.session_id,
    checkoutUrl: session.checkout_url,
  };
};

// ── Subscription lifecycle ───────────────────────────────────────────────────
// Cancellation in Dodo's model: set cancel_at_next_billing_date=true. The
// subscription remains 'active' until the period ends, then transitions to
// 'cancelled'. This matches our existing "keep access until period end" UX.
const cancelDodoSubscription = async (subscriptionId, { reason } = {}) => {
  const client = getClient();
  // Only attach cancellation_comment when the caller actually provided one —
  // Dodo's API rejects an explicit null on some accounts.
  const body = { cancel_at_next_billing_date: true, cancel_reason: 'cancelled_by_customer' };
  if (reason) body.cancellation_comment = reason;
  return client.subscriptions.update(subscriptionId, body);
};

// Resume = un-schedule the cancellation. Only valid if the period hasn't
// already lapsed (Dodo will reject otherwise — caller should pre-check).
const resumeDodoSubscription = async (subscriptionId) => {
  const client = getClient();
  return client.subscriptions.update(subscriptionId, {
    cancel_at_next_billing_date: false,
  });
};

// Fetch live subscription state from Dodo. Used to reconcile when our local
// cancel/resume API call fails (e.g. Dodo says "already in that state") — we
// can confirm the true state and patch our DB instead of bouncing the user.
const getDodoSubscription = async (subscriptionId) => {
  const client = getClient();
  return client.subscriptions.retrieve(subscriptionId);
};

// ── Refunds ──────────────────────────────────────────────────────────────────
// Subscription activations create a Payment under the hood; refunds attach to
// that payment, not the subscription itself. We look up the latest succeeded
// payment for the subscription, then refund it. If multiple payments exist
// (e.g. renewals), we take the EARLIEST succeeded one because the trial-window
// refund only applies to the initial activation charge.
const listSubscriptionPayments = async (subscriptionId) => {
  const client = getClient();
  // SDK returns a PagePromise — we want a single page of results sorted by
  // created_at. Default ordering on Dodo is newest-first; we'll re-sort
  // client-side to be safe.
  const page = await client.payments.list({
    subscription_id: subscriptionId,
    status: 'succeeded',
  });
  const items = Array.isArray(page && page.items) ? page.items
    : Array.isArray(page && page.data) ? page.data
    : [];
  return items;
};

const findActivationPaymentId = async (subscriptionId) => {
  const payments = await listSubscriptionPayments(subscriptionId);
  if (!payments.length) return null;
  const sorted = payments
    .filter((p) => p && (p.payment_id || p.id))
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  const oldest = sorted[0];
  return oldest ? (oldest.payment_id || oldest.id) : null;
};

const refundPayment = async (paymentId, { reason } = {}) => {
  const client = getClient();
  return client.refunds.create({
    payment_id: paymentId,
    reason: reason || 'Customer-requested refund within trial window',
  });
};

// ── Webhook verification ─────────────────────────────────────────────────────
// Uses the SDK's built-in Standard Webhooks unwrap. Throws on bad signature
// or expired timestamp. Caller MUST pass the RAW request body string.
const verifyWebhook = (rawBody, headers) => {
  const client = getClient();
  const key = process.env.DODO_WEBHOOK_SECRET;
  if (!key) throw new Error('DODO_WEBHOOK_SECRET not set');
  return client.webhooks.unwrap(rawBody, { headers, key });
};

module.exports = {
  isEnabled,
  getClient,
  createTopUpCheckout,
  createPlanCheckout,
  cancelDodoSubscription,
  resumeDodoSubscription,
  getDodoSubscription,
  listSubscriptionPayments,
  findActivationPaymentId,
  refundPayment,
  verifyWebhook,
  lookupPlanByProductId,
  lookupTopUpUsdByProductId,
};
