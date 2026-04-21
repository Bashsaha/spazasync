-- Phase 32: Business Compliance Profile
-- Track the 5 legal documents a spaza shop needs (municipal registration, CoA,
-- CIPC, business license, owner ID/permit). One row per (shop, document_type).

CREATE TABLE business_documents (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  document_type     TEXT        NOT NULL CHECK (document_type IN (
                                  'municipal_registration',
                                  'coa',
                                  'cipc',
                                  'business_license',
                                  'owner_id'
                                )),
  status            TEXT        NOT NULL CHECK (status IN (
                                  'valid',
                                  'expired',
                                  'pending',
                                  'not_registered',
                                  'not_required',
                                  'on_file'
                                )),
  reference_number  TEXT,
  date_issued       DATE,
  expiry_date       DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per document type per shop (enables upsert by composite key)
CREATE UNIQUE INDEX idx_business_documents_shop_type
  ON business_documents(shop_id, document_type);

-- Accelerates the dashboard traffic-light query
CREATE INDEX idx_business_documents_shop_expiry
  ON business_documents(shop_id, expiry_date);

ALTER TABLE business_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_business_documents_all"
  ON business_documents
  FOR ALL
  USING (user_in_shop(shop_id));

-- Keep updated_at in sync on UPDATE
CREATE OR REPLACE FUNCTION touch_business_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_documents_updated_at
  BEFORE UPDATE ON business_documents
  FOR EACH ROW
  EXECUTE FUNCTION touch_business_documents_updated_at();
