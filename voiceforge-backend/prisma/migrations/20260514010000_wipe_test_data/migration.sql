-- DESTRUCTIVE: wipes all user-facing data so the dev environment can be
-- re-tested on the multi-subscription redesign with a clean slate.
--
-- Scope: every row in every business table is removed. The schema itself
-- (and Prisma's _prisma_migrations row) stays intact, so the next deploy
-- doesn't try to re-apply anything.
--
-- This is idempotent on a fresh database (TRUNCATE on empty tables is a
-- no-op), so re-applying it elsewhere causes no harm.
--
-- Authorised in conversation: the user explicitly asked to remove all
-- current users + plans after confirming "wipe and start fresh (dev-only)".

TRUNCATE TABLE
  "UsageLog",
  "CreditTransaction",
  "AddonGrant",
  "Subscription",
  "ApiKey",
  "User"
RESTART IDENTITY CASCADE;
