-- Phase 17a: Add registration_number and location to shops
-- These fields support South African compliance requirements (R638)
-- Both are optional — owners can fill them in later via Settings

ALTER TABLE shops ADD COLUMN registration_number TEXT;
ALTER TABLE shops ADD COLUMN location TEXT;
