-- 041_subscription_grace_period.sql
-- Phase 54 — 4-day grace window between a subscription's end date and full expiry.
--
-- Lifecycle:
--   active   → (30d) → processing_cancellation → (4d grace, access KEPT) → expired
--   trialing → (7d)  → processing_cancellation → (4d grace, access KEPT) → expired
--
-- 'processing_cancellation' is set ONLY by the daily cron (expire_due_shops) —
-- never by an admin — so it is intentionally absent from the admin status enum.
--
-- This migration also re-defines expire_due_shops() (a Phase 45e inline-SQL
-- object that was never committed — see supabase/RUNBOOK.md) so the two-stage
-- lifecycle is reproducible from the repo.

-- 1. Widen the status CHECK constraint to allow the grace value. -------------
ALTER TABLE shops
  DROP CONSTRAINT IF EXISTS shops_subscription_status_check;

ALTER TABLE shops
  ADD CONSTRAINT shops_subscription_status_check
  CHECK (subscription_status IN (
    'trialing',
    'active',
    'cancelled',
    'expired',
    'manual_override',
    'processing_cancellation'
  ));

-- 2. Two-stage expire_due_shops(). --------------------------------------------
-- Stage A: a shop whose effective end date (trial_ends_at if trialing, else
--   subscription_ends_at) has just passed enters the grace window — status set
--   to 'processing_cancellation' and the deadline moved into subscription_ends_at
--   = original_end + 4 days, so the access gate's "other status + future end date"
--   branch (lib/subscription/expiry.ts) keeps it alive for exactly the grace window.
-- Stage B: a graced shop whose (extended) subscription_ends_at has now passed is
--   fully expired (status 'expired', access_granted = false).
--
-- Returns every shop_id touched in either stage (the cron re-reads those rows and
-- syncs each one's REAL state into JWT metadata). Idempotent & re-run-safe: the
-- two stages match disjoint statuses, and a row graced in this run is NOT visible
-- to Stage B in the same run (both CTE branches read the pre-statement snapshot),
-- so every shop spends at least one cron cycle in grace.

DROP FUNCTION IF EXISTS expire_due_shops();

CREATE FUNCTION expire_due_shops()
RETURNS TABLE (shop_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH graced AS (
    UPDATE shops s
    SET
      subscription_status  = 'processing_cancellation',
      subscription_ends_at =
        (CASE WHEN s.subscription_status = 'trialing'
              THEN s.trial_ends_at
              ELSE s.subscription_ends_at
         END) + INTERVAL '4 days'
      -- access_granted intentionally untouched: the shop keeps access in grace.
    WHERE s.subscription_status IN ('trialing', 'active')
      AND (CASE WHEN s.subscription_status = 'trialing'
                THEN s.trial_ends_at
                ELSE s.subscription_ends_at
           END) IS NOT NULL
      AND (CASE WHEN s.subscription_status = 'trialing'
                THEN s.trial_ends_at
                ELSE s.subscription_ends_at
           END) <= now()
    RETURNING s.id
  ),
  expired AS (
    UPDATE shops s
    SET
      subscription_status = 'expired',
      access_granted      = false
    WHERE s.subscription_status = 'processing_cancellation'
      AND s.subscription_ends_at IS NOT NULL
      AND s.subscription_ends_at <= now()
    RETURNING s.id
  )
  SELECT id FROM graced
  UNION
  SELECT id FROM expired;
END;
$$;
