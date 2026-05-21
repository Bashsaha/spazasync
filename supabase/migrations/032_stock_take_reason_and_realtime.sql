-- 032: stock-take "why is it lower" reason + realtime for cross-device freshness
--
-- Part 1 — Reason on stock-take entries
--   When a counted quantity comes in LOWER than the current stock, the person
--   must say why (unsure / damaged_expired / miscount / other). Stored here so
--   the owner's stock-loss report can attribute the shrinkage (and exclude
--   honest miscount corrections from the loss totals).
--
-- Part 2 — Realtime
--   So a teller's sale shows on the owner's dashboard without a reload, and a
--   stock count saved by one person reflects immediately for another counting
--   at the same time. We set REPLICA IDENTITY FULL so the client-side
--   `shop_id=eq.<id>` filter works for UPDATE/DELETE events, not just INSERT.

-- Part 1
ALTER TABLE stock_take_entries ADD COLUMN IF NOT EXISTS reason TEXT;

-- Part 2
ALTER TABLE sales REPLICA IDENTITY FULL;
ALTER TABLE products REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sales;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
  END IF;
END $$;
