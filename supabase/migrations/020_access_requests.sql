-- Phase 36c: Teller access requests
-- Tellers default to /sale only. To use /inventory + sub-routes (stock, stock-take,
-- products, expiry, suppliers) they must request access; the owner approves,
-- denies, or revokes a grant. Approvals expire automatically after 4 hours.

CREATE TABLE access_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  teller_id     UUID        NOT NULL REFERENCES tellers(id) ON DELETE CASCADE,
  feature       TEXT        NOT NULL DEFAULT 'inventory'
                            CHECK (feature IN ('inventory')),
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','granted','denied','revoked','expired')),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ,
  -- Free-form UUID; not a FK to auth.users so we don't trip RLS on the join.
  resolved_by   UUID,
  expires_at    TIMESTAMPTZ
);

-- Lookup paths used by the dashboard bell ("pending in my shop") and the
-- proxy's grant check ("does this teller have an active grant?").
CREATE INDEX idx_access_requests_shop_status   ON access_requests(shop_id, status);
CREATE INDEX idx_access_requests_teller_status ON access_requests(teller_id, status);

ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

-- Tellers see their own rows. Owners see all rows for their shop.
CREATE POLICY "select_access_requests"
  ON access_requests
  FOR SELECT
  USING (
    user_in_shop(shop_id) AND (
      user_is_owner(shop_id)
      OR teller_id IN (SELECT id FROM tellers WHERE user_id = auth.uid())
    )
  );

-- Tellers create their own pending requests. Owners cannot create on a
-- teller's behalf (they have other channels to grant access).
CREATE POLICY "insert_access_requests"
  ON access_requests
  FOR INSERT
  WITH CHECK (
    user_in_shop(shop_id)
    AND teller_id IN (SELECT id FROM tellers WHERE user_id = auth.uid())
  );

-- Only owners update (resolve, revoke).
CREATE POLICY "update_access_requests"
  ON access_requests
  FOR UPDATE
  USING (user_is_owner(shop_id))
  WITH CHECK (user_is_owner(shop_id));

-- Subscribe the table to the realtime publication so the owner's bell can
-- listen for INSERT (new request) and UPDATE (status change) events. RLS
-- still applies — each subscriber only receives events for rows they could
-- already SELECT.
ALTER PUBLICATION supabase_realtime ADD TABLE access_requests;
