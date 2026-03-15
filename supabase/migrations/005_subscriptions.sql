-- 005_subscriptions.sql
-- Adds subscription/payment columns to shops table for PayFast billing

ALTER TABLE shops
  ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'cancelled', 'expired')),
  ADD COLUMN trial_ends_at TIMESTAMPTZ,
  ADD COLUMN subscription_ends_at TIMESTAMPTZ,
  ADD COLUMN payfast_token TEXT;

-- Backfill: give existing shops a fresh 7-day trial
UPDATE shops
SET trial_ends_at = NOW() + INTERVAL '7 days'
WHERE trial_ends_at IS NULL;
