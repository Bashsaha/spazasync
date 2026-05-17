-- Phase 41b — Surface the official Durban Certificate of Acceptability PDF
-- ( https://www.durban.gov.za/uploads/0000/6/2025/09/21/certificate-of-acceptability-for-food-premises.pdf )
-- so the new <OfficialFormCallout> at the top of HealthCertificateStep can link
-- to it directly. The URL has been in the seed data since 37a but only as a
-- string buried inside `municipality_requirements.documents_required[].notes`,
-- which the UI never renders.
--
-- Idempotent — does nothing if the row already exists (a previous seed re-run
-- or a future seed bump may have added it).

INSERT INTO municipality_offices (
  municipality_id,
  office_type,
  name,
  address,
  area,
  phone,
  email,
  hours,
  online_form_url
)
SELECT
  m.id,
  'environmental_health',
  'eThekwini Environmental Health (CoA applications)',
  '7th Floor, Embassy Building, 199 Anton Lembede Street, Durban CBD',
  'Durban CBD',
  '031 311 4535',
  'businesslicensing@ethekwini.gov.za',
  'Mon-Fri 08:00-16:30',
  'https://www.durban.gov.za/uploads/0000/6/2025/09/21/certificate-of-acceptability-for-food-premises.pdf'
FROM municipalities m
WHERE m.name = 'eThekwini Municipality'
  AND NOT EXISTS (
    SELECT 1 FROM municipality_offices o
    WHERE o.municipality_id = m.id
      AND o.office_type = 'environmental_health'
  );
