-- Migration 034 — Cost-optimisation indexes
--
-- Targets sequential scans the planner falls into once a shop accumulates a
-- year+ of operational rows. None of these change schema or RLS; all
-- idempotent. Safe to re-run.
--
-- 1) compliance_reminders ledger — read on EVERY dashboard render via
--    getDashboardReminder() and on every notification-bell open via
--    listDashboardReminders(). Both filter on shop_id + (implicitly) order
--    by shown_at when picking buckets. Without this index, large ledgers
--    fall back to a sequential scan + sort.
CREATE INDEX IF NOT EXISTS idx_compliance_reminders_shop_shown_at
  ON public.compliance_reminders (shop_id, shown_at DESC);

-- 2) stock_take_entries — getStockTakeHistory() filters by shop_id then
--    orders by taken_at DESC. Migration 001 indexed shop_id only; once the
--    shop has more than a few thousand rows the planner sorts in memory.
CREATE INDEX IF NOT EXISTS idx_stock_take_entries_shop_taken_at
  ON public.stock_take_entries (shop_id, taken_at DESC);

-- 3) stock_adjustments — the stock-loss report (`/stock-take/loss`) filters
--    by shop_id, delta < 0, and a date range on adjusted_at. The same
--    composite shape (shop_id, adjusted_at) accelerates the report and any
--    future per-shop time-windowed read.
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_shop_adjusted_at
  ON public.stock_adjustments (shop_id, adjusted_at DESC);

COMMENT ON INDEX public.idx_compliance_reminders_shop_shown_at IS
  'Phase 37g — accelerates the dashboard reminder reader + retention cron (migration 034).';
COMMENT ON INDEX public.idx_stock_take_entries_shop_taken_at IS
  'Stock-take history reader — shop-scoped time-ordered scan (migration 034).';
COMMENT ON INDEX public.idx_stock_adjustments_shop_adjusted_at IS
  'Stock-loss report — shop-scoped time-windowed adjustments (migration 034).';
