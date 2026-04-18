-- Phase 30a: Supplier Directory
-- New table for shop suppliers — name required, everything else optional.

CREATE TABLE suppliers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  contact_number  TEXT,
  type            TEXT        CHECK (type IN ('wholesaler','distributor','farmer','other')),
  location        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_shop ON suppliers(shop_id);

-- Unique supplier name per shop (case-insensitive)
CREATE UNIQUE INDEX idx_suppliers_name_unique ON suppliers(shop_id, LOWER(name));

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_suppliers_all"
  ON suppliers
  FOR ALL
  USING (user_in_shop(shop_id));
