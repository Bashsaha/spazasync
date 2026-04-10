-- Phase 27a: Add language preference to shops table
-- Supported languages: en (English), so (Somali), am (Amharic), zu (IsiZulu), ur (Urdu)

ALTER TABLE shops
  ADD COLUMN language TEXT NOT NULL DEFAULT 'en'
  CONSTRAINT shops_language_check CHECK (language IN ('en', 'so', 'am', 'zu', 'ur'));
