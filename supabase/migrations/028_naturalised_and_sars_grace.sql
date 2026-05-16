-- Phase 41a — Compliance accuracy fixes
--
-- Two additions, both driven by the SEFA / SAnews R500M Spaza Shop Support
-- Fund guideline ( https://www.sanews.gov.za/south-africa/guideline-apply-r500-million-spaza-support-fund ):
--
-- 1. SA citizenship includes "naturalised as SA citizen prior to 1994".
--    Some foreign-born owners qualify for the fund under that clause but our
--    Phase 37b NationalityScreen only captured a binary sa_citizen / foreign
--    split, so they were silently locked out. We add a nullable boolean on
--    owner_profiles so the onboarding flow can ask a sub-question for
--    foreign-born owners. NULL = not asked (older profiles); FALSE = asked,
--    naturalised after 1994 or never; TRUE = naturalised before 1994 → treat
--    as SA citizen for fund eligibility.
--
-- 2. SARS registration grace period — the official rule is "valid SARS
--    registration OR a six-month transitional period to achieve this status".
--    We store an explicit DATE so the fund engine can treat sars_tax as
--    satisfied during the window. Backfill = shops.created_at + 6 months.
--    New shops: same default via column DEFAULT.

ALTER TABLE owner_profiles
  ADD COLUMN naturalised_pre_1994 BOOLEAN;

COMMENT ON COLUMN owner_profiles.naturalised_pre_1994 IS
  'NULL=not asked, TRUE=naturalised SA citizen before 1994 (treat as SA citizen for fund), FALSE=asked, does not qualify under the pre-1994 clause.';

ALTER TABLE shops
  ADD COLUMN sars_grace_period_until DATE;

COMMENT ON COLUMN shops.sars_grace_period_until IS
  'Six-month SARS registration grace period for the Spaza Shop Support Fund. Backfilled to created_at + 6 months for existing shops; new shops set at compliance-onboarding completion. After this date, sars_tax must be valid/on_file for fund readiness.';

UPDATE shops
SET sars_grace_period_until = (created_at + INTERVAL '6 months')::date
WHERE sars_grace_period_until IS NULL;
