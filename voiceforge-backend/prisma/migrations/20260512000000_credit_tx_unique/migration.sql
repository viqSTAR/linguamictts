-- Add idempotency unique constraint to CreditTransaction.
-- Prevents duplicate ADDON_TOPUP / PLAN_UPGRADE / MONTHLY_RESET rows
-- when a request is retried with the same referenceId.
--
-- Postgres treats NULLs as distinct, so legacy rows where referenceId IS NULL
-- (e.g. raw USAGE_DEDUCT logs) are unaffected by this constraint.

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_userId_type_referenceId_key"
  ON "CreditTransaction"("userId", "type", "referenceId");
