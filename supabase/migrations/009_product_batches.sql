-- Phase 17b: Product Expiry Date Tracking (Batch System)
-- Adds per-batch expiry dates with FEFO (First Expiry First Out) deduction during sales.

-- 1. Batch table — tracks quantities of a product by expiry date
CREATE TABLE product_batches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  expiry_date DATE        NOT NULL,
  quantity    INT         NOT NULL CHECK (quantity >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_batches_product_expiry ON product_batches(product_id, expiry_date);
CREATE INDEX idx_batches_shop_id ON product_batches(shop_id);

-- 2. RLS
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_batches_all"
  ON product_batches
  FOR ALL
  USING (user_in_shop(shop_id));

-- 3. FEFO stock deduction function
-- Decrements products.stock_qty AND consumes batches in earliest-expiry-first order.
-- If batches are exhausted before qty is fulfilled, the remainder is untracked stock — that's fine.
CREATE OR REPLACE FUNCTION decrement_stock_fefo(p_product_id UUID, p_qty INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_remaining INT := p_qty;
  v_batch RECORD;
BEGIN
  -- Decrement the main products.stock_qty (same as decrement_stock)
  UPDATE products
  SET stock_qty = stock_qty - p_qty
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  -- Consume from batches in FEFO order (earliest expiry first)
  FOR v_batch IN
    SELECT id, quantity
    FROM product_batches
    WHERE product_id = p_product_id AND quantity > 0
    ORDER BY expiry_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    IF v_batch.quantity <= v_remaining THEN
      -- Consume entire batch
      UPDATE product_batches SET quantity = 0 WHERE id = v_batch.id;
      v_remaining := v_remaining - v_batch.quantity;
    ELSE
      -- Partial consumption
      UPDATE product_batches SET quantity = quantity - v_remaining WHERE id = v_batch.id;
      v_remaining := 0;
    END IF;
  END LOOP;
END;
$$;
