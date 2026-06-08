-- Migration 038 — "No-name product" quick sale
--
-- Lets a teller ring up an unnamed / no-barcode loose item (loosie, single sweet,
-- ice, vetkoek …) without stopping mid-sale to create a full product. The sale
-- screen pins a per-shop catch-all product called "No-name product"; the teller
-- types the price inline and it goes straight into the cart. Because it is a real
-- `products` row it shows up in recent sales and reports for free.
--
-- Two columns:
--   track_stock  — general lever: when FALSE the item never deducts stock.
--   is_catch_all — identity: marks THE per-shop "No-name product" so we can find
--                  it, keep it unique, and hide it from product/stock management.
--
-- Why track_stock matters: products.stock_qty has CHECK (stock_qty >= 0) and the
-- decrement does plain subtraction (no clamp). A catch-all sitting at 0 stock
-- would drive to -1 and roll the WHOLE sale back. Skipping the decrement for
-- track_stock = false items is what makes the no-name sale possible.

-- 1. Columns (idempotent) ----------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS track_stock  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_catch_all BOOLEAN NOT NULL DEFAULT false;

-- 2. At most one catch-all product per shop -----------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS one_catch_all_per_shop
  ON products(shop_id) WHERE is_catch_all;

-- 3. FEFO deduction skips items that don't track stock ------------------------
-- `complete_sale` (verified live) calls the 3-ARG overload
-- decrement_stock_fefo(product_id, quantity, sale_id) once per cart line. There
-- are TWO overloads in production (the 2-arg from migration 009 and the 3-arg
-- from migration 011 that also records sale_batch_consumptions); Postgres routes
-- the 3-arg call to the 3-arg function. We patch BOTH so neither can deduct
-- stock for a track_stock=false item — the 3-arg is the load-bearing one for the
-- sale path; the 2-arg is patched for consistency in case anything still calls it.
--
-- search_path is re-pinned inline: CREATE OR REPLACE resets proconfig, which
-- would otherwise drop the hardening applied in migration 037.

-- 3a. 3-ARG overload — the one complete_sale uses (records batch consumptions).
CREATE OR REPLACE FUNCTION decrement_stock_fefo(p_product_id UUID, p_qty INT, p_sale_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_remaining INT := p_qty;
  v_batch RECORD;
  v_consumed INT;
  v_track BOOLEAN;
BEGIN
  -- Items that don't track stock (e.g. the "No-name product" catch-all) never
  -- move stock and never hit the stock_qty >= 0 CHECK. Bail before any UPDATE.
  SELECT track_stock INTO v_track FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;
  IF v_track IS FALSE THEN
    RETURN;
  END IF;

  -- Decrement the main products.stock_qty (same as decrement_stock)
  UPDATE products
  SET stock_qty = stock_qty - p_qty
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  -- Consume from batches in FEFO order (earliest expiry first)
  FOR v_batch IN
    SELECT id, quantity, expiry_date
    FROM product_batches
    WHERE product_id = p_product_id AND quantity > 0
    ORDER BY expiry_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    IF v_batch.quantity <= v_remaining THEN
      v_consumed := v_batch.quantity;
      UPDATE product_batches SET quantity = 0 WHERE id = v_batch.id;
      v_remaining := v_remaining - v_consumed;
    ELSE
      v_consumed := v_remaining;
      UPDATE product_batches SET quantity = quantity - v_remaining WHERE id = v_batch.id;
      v_remaining := 0;
    END IF;

    -- Record the consumption if we have a sale_id
    IF p_sale_id IS NOT NULL THEN
      INSERT INTO sale_batch_consumptions (sale_id, batch_id, product_id, qty_consumed, expiry_date)
      VALUES (p_sale_id, v_batch.id, p_product_id, v_consumed, v_batch.expiry_date);
    END IF;
  END LOOP;
END;
$$;

-- 3b. 2-ARG overload — patched for consistency (kept in case any caller remains).
CREATE OR REPLACE FUNCTION decrement_stock_fefo(p_product_id UUID, p_qty INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_remaining INT := p_qty;
  v_batch RECORD;
  v_track BOOLEAN;
BEGIN
  SELECT track_stock INTO v_track FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;
  IF v_track IS FALSE THEN
    RETURN;
  END IF;

  UPDATE products
  SET stock_qty = stock_qty - p_qty
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  FOR v_batch IN
    SELECT id, quantity
    FROM product_batches
    WHERE product_id = p_product_id AND quantity > 0
    ORDER BY expiry_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    IF v_batch.quantity <= v_remaining THEN
      UPDATE product_batches SET quantity = 0 WHERE id = v_batch.id;
      v_remaining := v_remaining - v_batch.quantity;
    ELSE
      UPDATE product_batches SET quantity = quantity - v_remaining WHERE id = v_batch.id;
      v_remaining := 0;
    END IF;
  END LOOP;
END;
$$;
