-- Migration 036 — scaling levers (WS2)
-- Two cheap, high-leverage hardening steps surfaced by the 100k-user scaling
-- research pass. Idempotent. Apply in the Supabase SQL Editor.
--
-- Context: the dominant scaling risk for this app is Supabase COMPUTE CPU at
-- peak (writes + RLS + aggregate functions), not connections (every DB read
-- goes through PostgREST's own pool — there are no raw Postgres connections in
-- the codebase, so Supavisor/prepared-statement tuning does not apply here).
-- These two changes protect that CPU budget.

-- 1) Per-role statement_timeout — a single pathological query (a huge ad-hoc
--    date range, a missing index after a schema change) can otherwise pin a CPU
--    core and cascade into a connection pile-up. Bound the request-facing roles.
--    DO NOT set a timeout on service_role: the cron jobs (expire-subscriptions,
--    archive-old-sales) and any maintenance run there and legitimately take
--    longer. Values are generous — every app query (indexed reads, GROUP BY
--    aggregates, the complete_sale RPC) is well under these. Tune if a real
--    workload needs more. Takes effect on new connections.
ALTER ROLE authenticated SET statement_timeout = '8s';
ALTER ROLE anon SET statement_timeout = '5s';

-- 2) Cover the RLS set-membership predicate. Phase 45a rewrote every shop-scoped
--    policy to `shop_id IN (SELECT shop_id FROM shop_users WHERE user_id =
--    (SELECT auth.uid()))`, which runs once per statement against shop_users.
--    A covering index on (user_id) INCLUDE (shop_id) makes that an index-only
--    scan instead of touching the heap on every policy evaluation.
--
--    NOTE: if shop_users already has a unique/PK index that LEADS with user_id
--    (e.g. UNIQUE(user_id, shop_id)), this is redundant — check first and skip:
--        SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'shop_users';
CREATE INDEX IF NOT EXISTS idx_shop_users_user_id_covering
  ON shop_users (user_id) INCLUDE (shop_id);
