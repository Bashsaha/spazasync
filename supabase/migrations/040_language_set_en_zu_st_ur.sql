-- Phase 52: Reduce supported languages to 4 — en (English), zu (IsiZulu),
-- st (Sesotho), ur (Urdu). Drops Somali ('so') and Amharic ('am'); adds
-- Sesotho ('st'). No live data migration needed: all existing shops use 'en'
-- (verified via REST before shipping). Any future 'so'/'am' values are
-- impossible to insert after the CHECK is tightened.

ALTER TABLE shops
  DROP CONSTRAINT IF EXISTS shops_language_check;

-- Defensive: fold any stray legacy values back to English before re-asserting
-- the constraint (no rows match today, but this keeps the migration idempotent
-- and safe if run against a copy that still has old data).
UPDATE shops SET language = 'en' WHERE language IN ('so', 'am');

ALTER TABLE shops
  ADD CONSTRAINT shops_language_check
  CHECK (language IN ('en', 'zu', 'st', 'ur'));
