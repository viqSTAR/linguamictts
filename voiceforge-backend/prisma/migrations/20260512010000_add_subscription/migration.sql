-- Subscription lifecycle fields for cancel + auto-pay support.
-- Defaults are safe for existing users:
--   subscriptionStatus = 'NONE'    (FREE users have no subscription)
--   autoRenew          = false     (paid users get autoRenew=true on upgrade)
--   currentPeriodEnd   = NULL      (only set on paid plans)
--   canceledAt         = NULL      (set when user clicks "Cancel")

ALTER TABLE "User"
  ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "currentPeriodEnd"   TIMESTAMP(3),
  ADD COLUMN "autoRenew"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canceledAt"         TIMESTAMP(3);

-- Backfill: any user already on a paid plan gets ACTIVE + autoRenew, with a
-- period end of the first day of the next calendar month (UTC).
UPDATE "User"
SET
  "subscriptionStatus" = 'ACTIVE',
  "autoRenew"          = true,
  "currentPeriodEnd"   = DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month'
WHERE "plan" <> 'FREE';
