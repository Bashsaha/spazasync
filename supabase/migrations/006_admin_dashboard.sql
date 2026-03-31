-- 006_admin_dashboard.sql
-- Adds admin dashboard infrastructure: manual access control, admin notes, manual payments

-- Expand subscription_status to include 'manual_override'
ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_subscription_status_check;
ALTER TABLE shops ADD CONSTRAINT shops_subscription_status_check
  CHECK (subscription_status IN ('trialing', 'active', 'cancelled', 'expired', 'manual_override'));

-- Admin can grant full access to a shop regardless of payment status
ALTER TABLE shops ADD COLUMN access_granted BOOLEAN NOT NULL DEFAULT FALSE;

-- Free-text notes field for admin annotations
ALTER TABLE shops ADD COLUMN admin_notes TEXT;

-- Manual payment log — accessed via admin (service role) client only
CREATE TABLE admin_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('eft', 'cash', 'card', 'other')),
  reference TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS enabled as defense in depth — no policies = zero access via anon/authenticated clients.
-- Service role bypasses RLS, so admin operations are unaffected.
ALTER TABLE admin_payments ENABLE ROW LEVEL SECURITY;
