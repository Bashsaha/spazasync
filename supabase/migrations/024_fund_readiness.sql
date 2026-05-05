-- Phase 37e: Fund Readiness Checker
-- Three small column additions that drive the new /compliance/fund page.
--
--   1. shops.fund_township_rural — eligibility question. NULL = not yet
--      answered (UI shows the question); TRUE/FALSE = answered. The fund
--      requires the shop to be in a township or rural area.
--   2. shops.fund_owner_managed — eligibility question. NULL/TRUE/FALSE
--      same semantics. The fund requires the owner to actively manage
--      the shop (no absentee owners).
--   3. owner_profiles.has_disability — priority status flag. The owner
--      volunteers this; it's the only "priority" attribute we capture
--      (DOB and gender are deliberately not stored — Design Rule 6).
--
-- No new tables, no new RLS policies — `shops` already has owner-scoped
-- policies and `owner_profiles` already has user-scoped policies.

ALTER TABLE shops
  ADD COLUMN fund_township_rural BOOLEAN;

ALTER TABLE shops
  ADD COLUMN fund_owner_managed BOOLEAN;

ALTER TABLE owner_profiles
  ADD COLUMN has_disability BOOLEAN NOT NULL DEFAULT false;
