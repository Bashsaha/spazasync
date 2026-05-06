-- Phase 37f — Foreign National Path
--
-- Captures visa type + visa expiry for foreign-national owners. Both columns
-- are nullable: SA citizens never set them, and foreign nationals may opt
-- "I don't know / doesn't expire" for the expiry date.
--
-- visa_type values:
--   'business_visa'        — Business visa
--   'asylum_seeker_s22'    — Section 22 asylum seeker permit
--   'refugee_s24'          — Section 24 refugee permit
--   'work_permit'          — Valid work permit allowing business
--   'other'                — Any other status the owner picked
--
-- The Phase 37g Smart Reminders module reads visa_expiry_date to fire 90/60/30
-- day nudges. This phase only captures the data; reminders ship in 37g.

ALTER TABLE owner_profiles
  ADD COLUMN visa_type TEXT
    CHECK (visa_type IN (
      'business_visa',
      'asylum_seeker_s22',
      'refugee_s24',
      'work_permit',
      'other'
    )),
  ADD COLUMN visa_expiry_date DATE;
