-- Phase 20b: Add UNIQUE constraint on sales.offline_id for offline dedup safety.
--
-- The sync engine retries failed sales. Without this constraint, a sale can be
-- inserted twice if the first POST succeeds at the DB level but the 201 response
-- is lost (network drop). The client retries, creating a duplicate.
--
-- Partial unique index: only applies to rows WHERE offline_id IS NOT NULL,
-- so online sales (offline_id = NULL) are unaffected.
--
-- Safety: first clean up any existing duplicates by keeping only the earliest.

-- Step 1: Remove duplicate offline_id rows (keep the earliest completed_at)
DELETE FROM sales
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY offline_id ORDER BY completed_at ASC) AS rn
    FROM sales
    WHERE offline_id IS NOT NULL
  ) dupes
  WHERE rn > 1
);

-- Step 2: Add partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_offline_id_unique
  ON sales (offline_id)
  WHERE offline_id IS NOT NULL;
