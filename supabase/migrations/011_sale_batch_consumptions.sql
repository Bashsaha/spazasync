-- Phase 19b: Batch Consumption Tracking on Sales
-- Records which expiry batches were consumed by each sale (audit trail for FEFO deductions).
-- Zero teller burden — fully automatic inside decrement_stock_fefo.

-- 1. Consumption audit table
CREATE TABLE sale_batch_consumptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      UUID        NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  batch_id     UUID        NOT NULL REFERENCES product_batches(id) ON DELETE CASCADE,
  product_id   UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty_consumed INT         NOT NULL CHECK (qty_consumed > 0),
  expiry_date  DATE        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sale_batch_sale ON sale_batch_consumptions(sale_id);
CREATE INDEX idx_sale_batch_batch ON sale_batch_consumptions(batch_id);

-- 2. RLS — scoped via sales.shop_id join
ALTER TABLE sale_batch_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_sale_batch_consumptions_all"
  ON sale_batch_consumptions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_batch_consumptions.sale_id
        AND user_in_shop(sales.shop_id)
    )
  );

-- 3. Replace decrement_stock_fefo — now accepts p_sale_id and records consumptions
CREATE OR REPLACE FUNCTION decrement_stock_fefo(p_product_id UUID, p_qty INT, p_sale_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_remaining INT := p_qty;
  v_batch RECORD;
  v_consumed INT;
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
    SELECT id, quantity, expiry_date
    FROM product_batches
    WHERE product_id = p_product_id AND quantity > 0
    ORDER BY expiry_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    IF v_batch.quantity <= v_remaining THEN
      -- Consume entire batch
      v_consumed := v_batch.quantity;
      UPDATE product_batches SET quantity = 0 WHERE id = v_batch.id;
      v_remaining := v_remaining - v_consumed;
    ELSE
      -- Partial consumption
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
