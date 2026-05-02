-- Phase 37b: Compliance Onboarding
-- Captures the data needed to drive a personalised compliance journey:
--   * person-level: nationality, food-safety training (one row per auth user,
--     so a single owner with multiple shops doesn't re-enter it)
--   * per-shop: municipality, has_employees, fund interest, onboarding state
--   * extended business_documents.document_type to cover SARS, UIF, food-safety
--     training, SMMESA registration (no overloading of existing types)
--
-- Built on top of Phase 37a (municipalities). Public-read RLS on
-- owner_profiles is rejected — these are personal records, so RLS allows
-- read/write only for the row's own user_id. Service-role bypasses for
-- atomic multi-table writes from /api/compliance-onboarding.

-- ─────────────────────────────────────────────────────────────
-- 1. owner_profiles — person-level compliance data
-- ─────────────────────────────────────────────────────────────

CREATE TABLE owner_profiles (
  user_id                          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nationality_type                 TEXT        CHECK (nationality_type IN ('sa_citizen','foreign_national')),
  food_safety_training_completed   BOOLEAN     NOT NULL DEFAULT false,
  food_safety_training_date        DATE,
  food_safety_training_provider    TEXT,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE owner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_owner_profile"
  ON owner_profiles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "insert_own_owner_profile"
  ON owner_profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own_owner_profile"
  ON owner_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 2. shops — per-shop compliance fields
-- ─────────────────────────────────────────────────────────────

ALTER TABLE shops
  ADD COLUMN municipality_id                       UUID        REFERENCES municipalities(id) ON DELETE SET NULL,
  ADD COLUMN municipality_area_text                TEXT,
  ADD COLUMN has_employees                         BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN fund_interest                         BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN onboarding_compliance_completed       BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN onboarding_compliance_dismissed_at    TIMESTAMPTZ,
  ADD COLUMN onboarding_compliance_dismiss_count   INT         NOT NULL DEFAULT 0;

CREATE INDEX idx_shops_municipality_id ON shops(municipality_id);

-- ─────────────────────────────────────────────────────────────
-- 3. business_documents — extend document_type to cover the new docs
-- captured by the compliance-onboarding flow. We DROP the existing
-- CHECK constraint and recreate it to add 'sars_tax', 'uif',
-- 'food_safety_training', 'smmesa'. SARS is a new type — never reused as
-- 'business_license', because they are legally distinct documents.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE business_documents
  DROP CONSTRAINT IF EXISTS business_documents_document_type_check;

ALTER TABLE business_documents
  ADD CONSTRAINT business_documents_document_type_check
  CHECK (document_type IN (
    'municipal_registration',
    'coa',
    'cipc',
    'business_license',
    'owner_id',
    'sars_tax',
    'uif',
    'food_safety_training',
    'smmesa'
  ));
