-- Phase 37a: Municipality Directory
-- Pure reference data. Lets every later compliance phase auto-populate
-- "where to go" / "what to bring" instructions for the owner's specific
-- municipality. No user-facing screens this phase.
--
-- Data sources are restricted to government-verified websites only
-- (joburg.org.za, tshwane.gov.za, ekurhuleni.gov.za, durban.gov.za,
-- capetown.gov.za, mangaung.co.za, gov.za, westerncape.gov.za).
-- Seeded by scripts/seed-municipalities.ts.

CREATE TABLE municipalities (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  province    TEXT        NOT NULL
                          CHECK (province IN (
                            'gauteng','western_cape','kzn','eastern_cape',
                            'free_state','limpopo','mpumalanga','north_west',
                            'northern_cape'
                          )),
  short_name  TEXT        NOT NULL,
  areas       TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, province)
);

CREATE INDEX idx_municipalities_province ON municipalities(province);
CREATE INDEX idx_municipalities_areas    ON municipalities USING GIN (areas);

CREATE TABLE municipality_offices (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id   UUID        NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  office_type       TEXT        NOT NULL
                                CHECK (office_type IN (
                                  'trading_permit',
                                  'environmental_health',
                                  'business_licensing',
                                  'customer_care'
                                )),
  name              TEXT        NOT NULL,
  address           TEXT        NOT NULL,
  area              TEXT,
  phone             TEXT,
  email             TEXT,
  hours             TEXT,
  online_portal_url TEXT,
  online_form_url   TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_municipality_offices_muni       ON municipality_offices(municipality_id);
CREATE INDEX idx_municipality_offices_muni_type  ON municipality_offices(municipality_id, office_type);

CREATE TABLE municipality_requirements (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id            UUID        NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  requirement_type           TEXT        NOT NULL
                                         CHECK (requirement_type IN (
                                           'trading_permit','coa','general'
                                         )),
  -- Each element: { name, applies_to, required, notes? }
  -- applies_to ∈ ('sa_citizen','foreign_national','all')
  documents_required         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  fees                       TEXT,
  estimated_processing_time  TEXT,
  additional_notes           TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (municipality_id, requirement_type)
);

CREATE INDEX idx_municipality_requirements_muni
  ON municipality_requirements(municipality_id);

-- ─────────────────────────────────────────────────────────────
-- RLS: reference data — anyone authenticated can SELECT.
-- All writes are service-role only (no INSERT/UPDATE/DELETE policies);
-- with RLS on and zero write policies, anon/authenticated clients
-- cannot mutate, while the service role bypasses RLS for the seed script
-- and any future admin tooling.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE municipalities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipality_offices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipality_requirements  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_municipalities"
  ON municipalities
  FOR SELECT
  USING (true);

CREATE POLICY "select_municipality_offices"
  ON municipality_offices
  FOR SELECT
  USING (true);

CREATE POLICY "select_municipality_requirements"
  ON municipality_requirements
  FOR SELECT
  USING (true);
