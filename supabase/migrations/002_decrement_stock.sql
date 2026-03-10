-- SpazaSync — Sales helpers
-- Apply after 001_initial_schema.sql

-- Decrement product stock atomically.
-- SECURITY INVOKER so RLS (shop_products policy) applies — only the owning
-- shop's users can decrement their own products.
-- The stock_qty >= 0 CHECK constraint on products prevents going negative.
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_qty INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_new_qty INT;
BEGIN
  UPDATE products
  SET stock_qty = stock_qty - p_qty
  WHERE id = p_product_id
  RETURNING stock_qty INTO v_new_qty;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  RETURN v_new_qty;
END;
$$;
