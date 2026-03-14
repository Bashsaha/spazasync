-- Make barcode optional on products
ALTER TABLE products ALTER COLUMN barcode DROP NOT NULL;

-- Drop the old unique constraint (barcode required)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_shop_id_barcode_key;

-- Add a partial unique index: barcodes must be unique per shop only when non-null
CREATE UNIQUE INDEX idx_products_shop_barcode_unique
  ON products(shop_id, barcode)
  WHERE barcode IS NOT NULL;
