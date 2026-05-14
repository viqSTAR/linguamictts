-- Multi-subscription redesign.
--
-- A user can now hold many paid subscriptions simultaneously (any plan, any
-- quantity). Each subscription has its own credit bucket, status, autoRenew
-- flag, period end, and Dodo subscription id. Usage drains buckets in FIFO
-- order: free monthly → oldest paid sub → oldest addon top-up.
--
-- This migration is DESTRUCTIVE: it drops the old single-plan columns on
-- User. Any in-flight subscription state stored there is lost — users keep
-- their accounts and cached creditsBalance only. Approved as "dev-only"
-- when the redesign was scoped.

-- ── New per-subscription state ──────────────────────────────────────────────
CREATE TABLE "Subscription" (
  "id"                 TEXT        NOT NULL,
  "userId"             TEXT        NOT NULL,
  "planKey"            TEXT        NOT NULL,
  "monthlyCredits"     INTEGER     NOT NULL,
  "creditsRemaining"   INTEGER     NOT NULL,
  "status"             TEXT        NOT NULL DEFAULT 'ACTIVE',
  "autoRenew"          BOOLEAN     NOT NULL DEFAULT true,
  "currentPeriodEnd"   TIMESTAMP(3) NOT NULL,
  "canceledAt"         TIMESTAMP(3),
  "dodoSubscriptionId" TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_dodoSubscriptionId_key"
  ON "Subscription"("dodoSubscriptionId");
CREATE INDEX "Subscription_userId_createdAt_idx"
  ON "Subscription"("userId", "createdAt");
CREATE INDEX "Subscription_userId_status_idx"
  ON "Subscription"("userId", "status");

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── New per-top-up grant rows (FIFO, permanent) ─────────────────────────────
CREATE TABLE "AddonGrant" (
  "id"               TEXT        NOT NULL,
  "userId"           TEXT        NOT NULL,
  "creditsRemaining" INTEGER     NOT NULL,
  "originalAmount"   INTEGER     NOT NULL,
  "amountUSD"        INTEGER     NOT NULL,
  "dodoPaymentId"    TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AddonGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AddonGrant_dodoPaymentId_key"
  ON "AddonGrant"("dodoPaymentId");
CREATE INDEX "AddonGrant_userId_createdAt_idx"
  ON "AddonGrant"("userId", "createdAt");

ALTER TABLE "AddonGrant"
  ADD CONSTRAINT "AddonGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Drop the old single-plan / single-subscription columns from User ────────
-- These are now represented by Subscription rows. Drop the unique index first
-- because Postgres won't let you drop a column that backs a unique index.
DROP INDEX IF EXISTS "User_dodoSubscriptionId_key";

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "plan",
  DROP COLUMN IF EXISTS "planMonthlyCredits",
  DROP COLUMN IF EXISTS "planStartedAt",
  DROP COLUMN IF EXISTS "subscriptionStatus",
  DROP COLUMN IF EXISTS "currentPeriodEnd",
  DROP COLUMN IF EXISTS "autoRenew",
  DROP COLUMN IF EXISTS "canceledAt",
  DROP COLUMN IF EXISTS "dodoSubscriptionId";

-- The PlanTier enum is no longer referenced anywhere — drop it.
DROP TYPE IF EXISTS "PlanTier";

-- ── Add the per-user free monthly bucket ────────────────────────────────────
-- Every user has a free-tier monthly allowance separate from any paid sub.
-- It's the first bucket drained on each generation, then resets at the start
-- of each calendar month via ensureMonthlyCredits.
ALTER TABLE "User"
  ADD COLUMN "freeCreditsRemaining" INTEGER NOT NULL DEFAULT 12000,
  ADD COLUMN "freeMonthKey"         TEXT;

-- Seed sane initial values for existing users so they get this month's
-- free allowance immediately. The middleware top-up runs on the first
-- authenticated request afterwards.
UPDATE "User"
SET "freeCreditsRemaining" = LEAST("creditsBalance", 12000),
    "freeMonthKey"         = NULL;
