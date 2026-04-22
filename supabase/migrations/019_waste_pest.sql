-- Phase 33: Waste Management & Pest Control Log
-- Three surfaces: daily checklist addition, pest visit log, waste arrangement singleton.

-- 1. Add waste-bin question to the existing daily checklist (Phase 31 table).
ALTER TABLE daily_checklists ADD COLUMN waste_bins_ok BOOLEAN;

-- 2. Pest control log (multiple rows per shop — one per visit).
CREATE TABLE pest_control_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  visit_date     DATE        NOT NULL,
  provider_name  TEXT        NOT NULL,
  treatment_type TEXT        NOT NULL,
  notes          TEXT,
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pest_control_logs_shop_date ON pest_control_logs(shop_id, visit_date DESC);

ALTER TABLE pest_control_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_pest_logs_all"
  ON pest_control_logs
  FOR ALL
  USING (user_in_shop(shop_id));

-- 3. Waste arrangement (one row per shop — singleton keyed by shop_id).
CREATE TABLE waste_management (
  shop_id             UUID        PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  removal_type        TEXT        NOT NULL CHECK (removal_type IN ('municipal','private','self_disposal')),
  frequency           TEXT        NOT NULL CHECK (frequency IN ('daily','weekly','twice_weekly','monthly','other')),
  provider_name       TEXT,
  last_confirmed_date DATE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE waste_management ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_waste_management_all"
  ON waste_management
  FOR ALL
  USING (user_in_shop(shop_id));
