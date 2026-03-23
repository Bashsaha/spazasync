-- Phase 18b: Case-insensitive unique product names per shop
-- Prevents creating two products with the same name (e.g. "Milk" and "milk")
CREATE UNIQUE INDEX idx_products_shop_name_unique
  ON products(shop_id, LOWER(name));
