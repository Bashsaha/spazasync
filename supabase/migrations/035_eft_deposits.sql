-- 035_eft_deposits.sql
-- Admin EFT reconciliation: idempotent ledger of bank deposits that have been
-- applied to a shop's subscription via the /admin/eft-reconcile upload tool.
--
-- The UNIQUE(dedupe_key) constraint is the idempotency surface: re-uploading
-- overlapping bank-statement date ranges (expected, because EFT clears 1-2 days
-- late) can never double-credit a shop. A row's existence == "this deposit was
-- applied". Non-applied classifications (unmatched / needs-review / duplicate)
-- are computed at upload time and returned to the UI, never persisted here.

CREATE TABLE IF NOT EXISTS eft_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
  deposit_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  raw_reference TEXT,
  matched_code TEXT,
  months_applied INT NOT NULL DEFAULT 1 CHECK (months_applied >= 1),
  new_subscription_ends_at TIMESTAMPTZ,
  admin_payment_id UUID REFERENCES admin_payments(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS eft_deposits_shop_id_idx ON eft_deposits (shop_id);
CREATE INDEX IF NOT EXISTS eft_deposits_deposit_date_idx ON eft_deposits (deposit_date DESC);

-- RLS enabled as defense in depth — no policies = zero access via
-- anon/authenticated clients (BUG-012 pattern). Service role bypasses RLS,
-- so admin operations are unaffected.
ALTER TABLE eft_deposits ENABLE ROW LEVEL SECURITY;
