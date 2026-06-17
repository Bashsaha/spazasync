-- Migration 039 — Field Sales / shop-visit CRM (admin-only)
--
-- The admin portal grows beyond shop-administration into a lightweight
-- field-sales tool for the operator: a list of shops they visit ("leads" —
-- a mix of prospects not yet on Movestock AND existing customers being checked
-- in on), the visits / touchpoints logged against each one, and a per-lead
-- follow-up reminder so nobody falls through the cracks.
--
-- These tables are OPERATOR-scoped, not shop-scoped: there is no `user_in_shop`
-- relationship to enforce. They follow the documented "service-role only"
-- recipe used by admin_payments / eft_deposits / admin_alerts (BUG-012 pattern):
--   RLS ENABLED + NO POLICIES. Every read/write goes through createAdminClient()
--   inside an /api/admin/* route already gated by requireAdmin(). With RLS on and
--   no policies, the anon/auth roles get zero rows — only the service role (which
--   bypasses RLS) can touch them.

-- 1. leads — one row per shop the operator is selling to / visiting -----------
CREATE TABLE IF NOT EXISTS leads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name      TEXT NOT NULL,
  owner_name         TEXT,
  phone              TEXT,
  whatsapp_number    TEXT,
  address            TEXT,
  area               TEXT,                       -- township / suburb / area (free text)
  status             TEXT NOT NULL DEFAULT 'prospect'
                       CHECK (status IN ('prospect','contacted','interested','signed','not_interested')),
  notes              TEXT,                        -- general notes about the lead
  -- Bridge to an existing Movestock customer: NULL while a prospect, set once
  -- they sign up. ON DELETE SET NULL so removing a shop never deletes CRM history.
  shop_id            UUID REFERENCES shops(id) ON DELETE SET NULL,
  -- Per-lead follow-up reminder (the "call them back" date). Drives the
  -- "Follow-ups due" list on the field-sales hub. Set/cleared when logging a visit.
  next_follow_up_at   DATE,
  next_follow_up_note TEXT,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_status_idx          ON leads(status);
CREATE INDEX IF NOT EXISTS leads_area_idx            ON leads(area);
CREATE INDEX IF NOT EXISTS leads_shop_id_idx         ON leads(shop_id);
CREATE INDEX IF NOT EXISTS leads_follow_up_idx       ON leads(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_created_at_idx       ON leads(created_at DESC);

-- 2. shop_visits — one row per physical visit / touchpoint --------------------
CREATE TABLE IF NOT EXISTS shop_visits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  visited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes       TEXT,
  outcome     TEXT
                CHECK (outcome IN ('left_info','demo_given','callback','signed','not_interested','no_answer','other')),
  visited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_visits_lead_id_idx    ON shop_visits(lead_id);
CREATE INDEX IF NOT EXISTS shop_visits_visited_at_idx ON shop_visits(visited_at DESC);

-- 3. RLS: enabled, NO policies (service-role only — BUG-012 pattern) ----------
ALTER TABLE leads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_visits ENABLE ROW LEVEL SECURITY;
-- Intentionally no CREATE POLICY statements: the anon + authenticated roles see
-- zero rows; all access is via the service role through /api/admin/* routes.
