-- Phase 31: Daily Compliance Checklist
-- One row per shop per day capturing temperature, cleaning, and expired-item checks.
-- UPSERT semantics on (shop_id, date) so re-opening today's checklist edits the same row.

-- 1. Equipment toggles on shops — default true so existing shops keep the full checklist.
ALTER TABLE shops ADD COLUMN has_fridge  BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE shops ADD COLUMN has_freezer BOOLEAN NOT NULL DEFAULT true;

-- 2. Daily checklist table
CREATE TABLE daily_checklists (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  date                  DATE        NOT NULL,

  fridge_ok             BOOLEAN,
  fridge_temp           NUMERIC(4,1),
  freezer_ok            BOOLEAN,
  freezer_temp          NUMERIC(4,1),

  surfaces_cleaned      BOOLEAN,
  floor_cleaned         BOOLEAN,
  storage_clean         BOOLEAN,

  expired_items_action  TEXT CHECK (expired_items_action IN ('none_found','removed','skipped')),

  completed_by          UUID,
  completed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (shop_id, date)
);

CREATE INDEX idx_daily_checklists_shop_date ON daily_checklists(shop_id, date DESC);

ALTER TABLE daily_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_daily_checklists_all"
  ON daily_checklists
  FOR ALL
  USING (user_in_shop(shop_id));
