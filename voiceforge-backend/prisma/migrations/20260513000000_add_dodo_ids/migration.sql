-- Dodo Payments integration: track external customer and subscription IDs so
-- the webhook can reattach Dodo events to our user, and so cancel/resume can
-- call the Dodo API by subscription_id. Both nullable — only populated once
-- the user has interacted with Dodo (FREE users will never have these set).

ALTER TABLE "User"
  ADD COLUMN "dodoCustomerId"     TEXT,
  ADD COLUMN "dodoSubscriptionId" TEXT;

-- Unique on subscription id so the webhook handler can look up the user by
-- the subscription_id on incoming events without ambiguity. Customer id is
-- intentionally NOT unique — Dodo allows multiple users to share one
-- customer record in edge cases, and uniqueness is enforced on email already.
CREATE UNIQUE INDEX "User_dodoSubscriptionId_key" ON "User"("dodoSubscriptionId");
CREATE INDEX "User_dodoCustomerId_idx" ON "User"("dodoCustomerId");
