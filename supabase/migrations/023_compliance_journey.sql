-- Phase 37c: Compliance Journey Hub
-- Three tightly-scoped changes that let the new /compliance/journey page
-- track step progression on top of the existing business_documents +
-- tellers tables — no new tables.
--
--   1. Extend business_documents.status with 'in_progress' so a step can
--      sit between "not started" and "complete" once the owner taps
--      "I've applied" and supplies a reference number.
--   2. Add applied_at TIMESTAMPTZ on business_documents so we can render
--      "Submitted X weeks ago" copy and remind owners about long waits.
--   3. Add food_safety_trained_at TIMESTAMPTZ on tellers so Step 6
--      (Food Safety) can show a per-staff trained / not-trained list.

-- ─────────────────────────────────────────────────────────────
-- 1. Extend business_documents.status CHECK constraint
-- ─────────────────────────────────────────────────────────────

ALTER TABLE business_documents
  DROP CONSTRAINT IF EXISTS business_documents_status_check;

ALTER TABLE business_documents
  ADD CONSTRAINT business_documents_status_check
  CHECK (status IN (
    'valid',
    'expired',
    'pending',
    'not_registered',
    'not_required',
    'on_file',
    'in_progress'
  ));

-- ─────────────────────────────────────────────────────────────
-- 2. business_documents.applied_at — when owner tapped "I've applied"
-- ─────────────────────────────────────────────────────────────

ALTER TABLE business_documents
  ADD COLUMN applied_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────
-- 3. tellers.food_safety_trained_at — Step 6 staff training tracker
-- ─────────────────────────────────────────────────────────────

ALTER TABLE tellers
  ADD COLUMN food_safety_trained_at TIMESTAMPTZ;
