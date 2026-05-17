-- Phase 41e — Compliance verification log.
--
-- Drives the admin-dashboard widget that shows "Last verified: {date} ({N}
-- days ago)" and alerts when N >= 30. The 30-day cadence was set in
-- tasks/compliance-facts-audit.md — every 30 days an admin runs the manual
-- Claude-driven audit and POSTs to /api/admin/compliance-verification/mark-done
-- which inserts a new row here.
--
-- Why a table not a single config value?
--   - Gives us a history (each verification is a row, append-only).
--   - Lets us record WHICH phase the verification came from (e.g. "41d" or
--     "manual-2026-06-16") so we can correlate audit work with deploys.
--   - Free-form notes column for the auditor to record anything notable.
--
-- Service-role-only writes; admins read via the admin route. Owners +
-- tellers never touch this table.

CREATE TABLE compliance_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phase TEXT,        -- e.g. "41d", "manual-2026-06-16"
  notes TEXT
);

CREATE INDEX idx_compliance_verification_log_verified_at
  ON compliance_verification_log (verified_at DESC);

ALTER TABLE compliance_verification_log ENABLE ROW LEVEL SECURITY;

-- No policies — service role bypasses RLS automatically, and we want owners
-- + tellers to have zero visibility into this table. The admin route uses
-- createAdminClient() which uses the service role key.

COMMENT ON TABLE compliance_verification_log IS
  'Append-only log of compliance-facts audit runs (every 30 days per tasks/compliance-facts-audit.md). Service-role-only writes via /api/admin/compliance-verification/mark-done.';

-- Seed the initial row so the admin widget shows "Last verified: 2026-05-17"
-- on first load rather than "Never verified" (which would fire the >=30-day
-- alert immediately for the wrong reason).
INSERT INTO compliance_verification_log (verified_at, phase, notes)
VALUES (
  '2026-05-17T00:00:00Z',
  '41d',
  'Phase 41a/41b/41c/41d sweep — verified URLs, fees, thresholds, regulation references against .gov.za / sefa.org.za / sanews.gov.za / cipc.co.za / sars.gov.za / 6 metro sites. See tasks/compliance-facts-audit.md Audit log table for details.'
);
