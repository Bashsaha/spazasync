-- Phase 28: Profit Tracking (opt-in per shop)
--
-- Adds a per-shop toggle that, when enabled, makes cost_price required on
-- product create/edit and surfaces profit metrics on the dashboard + daily
-- summary. Defaults to OFF so existing shops are unaffected.
--
-- sale_items.unit_cost is a snapshot of the product's cost_price at the
-- moment of sale, so updating a product's cost price later does not
-- retroactively change historical profit.

-- Shop-level toggle (default OFF — opt-in)
ALTER TABLE shops
  ADD COLUMN profit_tracking_enabled BOOLEAN NOT NULL DEFAULT false;

-- Product-level cost (nullable — only required at the API layer when toggle is on)
ALTER TABLE products
  ADD COLUMN cost_price NUMERIC(10, 2)
  CHECK (cost_price IS NULL OR cost_price >= 0);

-- Snapshot cost at sale time for historical accuracy
ALTER TABLE sale_items
  ADD COLUMN unit_cost NUMERIC(10, 2)
  CHECK (unit_cost IS NULL OR unit_cost >= 0);
