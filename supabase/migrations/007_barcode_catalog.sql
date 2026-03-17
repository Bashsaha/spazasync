-- 007_barcode_catalog.sql
-- Shared barcode catalog — global product name lookup for all shops.
-- Shops read from this table when a scanned barcode is not in their own products table.
-- Only the admin (service role) client can write to this table.

CREATE TABLE barcode_catalog (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode    TEXT        NOT NULL UNIQUE,
  name       TEXT        NOT NULL,
  category   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_barcode_catalog_barcode ON barcode_catalog(barcode);

-- RLS: any authenticated user can read, nobody can write via anon/authenticated client
ALTER TABLE barcode_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "barcode_catalog_select"
  ON barcode_catalog FOR SELECT
  USING (true);
