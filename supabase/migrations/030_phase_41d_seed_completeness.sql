-- Phase 41d — Seed data completeness pass against verified official sources.
--
-- Closes the 4 "bare metro" gaps logged in tasks/compliance-facts-audit.md:
--   * Ekurhuleni had no online_form_url anywhere — adds 2 official PDFs
--     (Trading Permit form + Business Licence/spaza form) + the Business
--     Licensing & Permits hub portal.
--   * Mangaung had a placeholder mangaung.co.za root URL — replaced with the
--     actual spaza/tuckshop/general-dealer application PDF.
--   * Joburg + Tshwane + Cape Town had no environmental_health office wired
--     for the R638 CoA form (only Durban did, since Phase 41b migration 029).
--     Adds env-health office rows so OfficialFormCallout renders the correct
--     metro CoA form/portal on the Health Certificate step.
--
-- All operations are idempotent (UPDATE-where-already-stale, or
-- INSERT-where-not-exists). Safe to re-run.

-- ── 1. Mangaung trading_permit office — strip dead URLs, keep helpline ───
-- Both the 2020 PDF and the 2020 article that linked to it return 404 as of
-- 2026-05-17. Mangaung's web presence for spaza applications is broken, so
-- we strip the URL fields entirely (OfficialFormCallout will hide its CTA)
-- and use notes to surface the SMME helpline 0800 111 300 as the only
-- working channel.
UPDATE municipality_offices
SET
  name = 'SMME Unit, Bram Fischer Building',
  address = '9th Floor, Bram Fischer Building, Bloemfontein',
  area = 'Bloemfontein',
  online_form_url = NULL,
  online_portal_url = NULL,
  notes = 'No online form currently available — call 0800 111 300 or visit the SMME Unit at Bram Fischer Building (9th floor) for the current spaza / tuck shop / general dealer application form.'
WHERE municipality_id = (SELECT id FROM municipalities WHERE name = 'Mangaung Metropolitan Municipality')
  AND office_type = 'trading_permit';

-- ── 2. Ekurhuleni trading_permit office — INSERT if missing ───────────────
INSERT INTO municipality_offices (
  municipality_id, office_type, name, address, hours,
  online_form_url, online_portal_url
)
SELECT
  m.id,
  'trading_permit',
  'Economic Development — Trading Permits',
  'Nearest Customer Care Centre across 5 regions',
  'Mon-Fri 08:00-16:30',
  'https://www.ekurhuleni.gov.za/wp-content/uploads/2025/02/Trading-Application-Form-1.pdf',
  'https://businesslicensingandpermits.ekurhuleni.gov.za/'
FROM municipalities m
WHERE m.name = 'City of Ekurhuleni'
  AND NOT EXISTS (
    SELECT 1 FROM municipality_offices o
    WHERE o.municipality_id = m.id
      AND o.office_type = 'trading_permit'
  );

-- ── 3. Ekurhuleni business_licensing office — INSERT if missing ───────────
INSERT INTO municipality_offices (
  municipality_id, office_type, name, address, hours,
  online_form_url, online_portal_url, notes
)
SELECT
  m.id,
  'business_licensing',
  'Business Licensing (spaza / tuck shop)',
  'Nearest Customer Care Centre across 5 regions',
  'Mon-Fri 08:00-16:30',
  'https://www.ekurhuleni.gov.za/wp-content/uploads/2025/02/BUSINESS-LICENCE-Application-form-and-checklist-002-1.pdf',
  'https://businesslicensingandpermits.ekurhuleni.gov.za/',
  'Business Licence Application form applies to spaza / tuck shops.'
FROM municipalities m
WHERE m.name = 'City of Ekurhuleni'
  AND NOT EXISTS (
    SELECT 1 FROM municipality_offices o
    WHERE o.municipality_id = m.id
      AND o.office_type = 'business_licensing'
  );

-- ── 4. Joburg environmental_health office — INSERT if missing ─────────────
-- Joburg's CoA application is bundled into the Form 13 spaza registration
-- flow (no standalone CoA PDF). Wire as a portal URL pointing at the spaza
-- shop registration landing page.
INSERT INTO municipality_offices (
  municipality_id, office_type, name, address, area, hours, online_portal_url
)
SELECT
  m.id,
  'environmental_health',
  'Environmental Health (via Spaza Shop Registration)',
  'Application bundled with Form 13 — submitted to Town Planning Help Desk; circulated to Environmental Health for comment',
  'Braamfontein',
  'Mon-Fri 08:00-16:30',
  'https://joburg.org.za/Pages/Spaza-shops-Registration.aspx'
FROM municipalities m
WHERE m.name = 'City of Johannesburg'
  AND NOT EXISTS (
    SELECT 1 FROM municipality_offices o
    WHERE o.municipality_id = m.id
      AND o.office_type = 'environmental_health'
  );

-- ── 5. Tshwane environmental_health office — INSERT if missing ────────────
INSERT INTO municipality_offices (
  municipality_id, office_type, name, address, area, hours, online_form_url
)
SELECT
  m.id,
  'environmental_health',
  'City of Tshwane Environmental Health (R638 CoA)',
  'Application via nearest Customer Care Centre',
  'Pretoria CBD',
  'Mon-Fri 08:00-16:30',
  'https://www.tshwane.gov.za/?wpfd_file=application-form-for-a-r638-certificate-2'
FROM municipalities m
WHERE m.name = 'City of Tshwane'
  AND NOT EXISTS (
    SELECT 1 FROM municipality_offices o
    WHERE o.municipality_id = m.id
      AND o.office_type = 'environmental_health'
  );

-- ── 6. Cape Town environmental_health office — UPDATE if it lacks the PDF ─
-- Cape Town already has an env-health office (seeded Phase 37a) but only
-- with the portal URL; add the official R638 CoA PDF so OfficialFormCallout
-- prefers the direct PDF download.
UPDATE municipality_offices
SET
  online_form_url = 'https://resource.capetown.gov.za/documentcentre/Documents/Forms,%20notices,%20tariffs%20and%20lists/Certificate%20of%20Acceptability.pdf',
  online_portal_url = 'https://www.capetown.gov.za/City-Connect/Apply/Health-and-safety/Environmental-health/Apply-for-a-certificate-of-acceptability',
  notes = 'Online CoA application system operational. Paper submissions also accepted.'
WHERE municipality_id = (SELECT id FROM municipalities WHERE name = 'City of Cape Town')
  AND office_type = 'environmental_health'
  AND online_form_url IS NULL;
