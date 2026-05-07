-- Phase 37g — Smart Reminders & Nudges
--
-- Two new tables:
--
-- 1. compliance_reminders — shop-scoped ledger that tracks when each reminder
--    instance was first shown and (if ever) dismissed. UNIQUE(shop_id, reminder_key)
--    is the dedupe surface; the evaluator generates a fresh `reminder_key` per
--    cycle (e.g. weekly journey-nudge buckets, biweekly fund-nudge buckets,
--    once-per-document expiry buckets), so once a row exists for a given key
--    that reminder won't fire again until the next cycle produces a new key.
--
-- 2. admin_alerts — global broadcasts authored from /admin/alerts. Public-read
--    via RLS but only when within the active window (starts_at/expires_at);
--    writes are service-role only.

-- ── compliance_reminders ────────────────────────────────────────────────────

CREATE TABLE compliance_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN (
    'coa_expiry',
    'permit_expiry',
    'cipc_annual',
    'visa_expiry',
    'journey_nudge',
    'fund_nudge',
    'fund_qualified',
    'score_drop',
    'checklist_streak',
    'admin_alert'
  )),
  reminder_key TEXT NOT NULL,
  shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, reminder_key)
);

CREATE INDEX idx_compliance_reminders_shop ON compliance_reminders(shop_id);

ALTER TABLE compliance_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_reminders_select_own"
  ON compliance_reminders FOR SELECT
  USING (user_in_shop(shop_id));

CREATE POLICY "compliance_reminders_insert_own"
  ON compliance_reminders FOR INSERT
  WITH CHECK (user_in_shop(shop_id));

CREATE POLICY "compliance_reminders_update_own"
  ON compliance_reminders FOR UPDATE
  USING (user_in_shop(shop_id));

-- ── admin_alerts ────────────────────────────────────────────────────────────

CREATE TABLE admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_text TEXT,
  link_url TEXT,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'high', 'urgent')),
  target_audience TEXT NOT NULL DEFAULT 'all'
    CHECK (target_audience IN ('all', 'sa_citizen', 'foreign_national')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_alerts_active ON admin_alerts(starts_at, expires_at);

ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;

-- Public-read of active alerts only. The evaluator filters by audience in code
-- after reading the row (reading the row tells us nothing sensitive — the title
-- + message are intended to be visible to every shop in the targeted audience).
CREATE POLICY "admin_alerts_read_active"
  ON admin_alerts FOR SELECT
  USING (starts_at <= now() AND (expires_at IS NULL OR expires_at > now()));
-- No INSERT / UPDATE / DELETE policies → anon + authenticated clients are
-- locked out of writes. Service-role bypasses RLS, so /api/admin/alerts is the
-- only path that can mutate.
