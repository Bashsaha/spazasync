-- Migration 037 — Security hardening: pin search_path on security-relevant functions
-- (audit findings L2 + D6).
--
-- A function — especially SECURITY DEFINER — with an UNPINNED search_path resolves
-- unqualified object names using the CALLER's search_path. That's an object-shadowing
-- privilege-escalation vector (an attacker who can create a same-named object earlier
-- in the resolution path can subvert the function), and Supabase's linter flags it
-- (function_search_path_mutable). user_in_shop / user_is_owner are the root of trust
-- for EVERY shop-scoped RLS policy, so they matter most.
--
-- Pinning to `public, pg_temp` is PURE hardening — identical behaviour, every
-- unqualified name now resolves in `public` only.
--
-- This loops over the known security-relevant functions (including the Phase-45
-- objects that were applied directly to Supabase and are NOT in earlier migration
-- files), pins EVERY overload regardless of signature, and SKIPS any already pinned.
-- Safe to re-run (idempotent).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'user_in_shop', 'user_is_owner',
        'decrement_stock', 'decrement_stock_fefo',
        'touch_business_documents_updated_at',
        'complete_sale', 'shop_daily_summary', 'shop_sales_statistics',
        'shop_popular_products', 'expire_due_shops', 'broadcast_shop_change',
        'db_size_stats', 'archive_old_sales'
      )
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
    RAISE NOTICE 'pinned search_path on %', r.sig;
  END LOOP;
END $$;

-- VERIFY (should return ZERO rows after running): SECURITY DEFINER functions in
-- public with no pinned search_path.
--   SELECT p.proname, pg_get_function_identity_arguments(p.oid)
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.prosecdef
--     AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) c WHERE c LIKE 'search_path=%');

-- DEFERRED (need the live-policy dump first — see the audit SQL handed over in chat,
-- do NOT generate blind because Phase 45a rewrote these policies live, not in-repo):
--   * explicit WITH CHECK on the shop-scoped FOR ALL policies (semantically a no-op
--     over today's implicit USING-as-WITH-CHECK, but makes intent auditable);
--   * (SELECT auth.uid()) wrap on owner_profiles / access_requests policies (perf).
