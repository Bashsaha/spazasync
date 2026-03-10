-- SpazaSync — Initial Schema
-- Apply to Supabase via: Dashboard > SQL Editor, or supabase db push

-- ============================================================
-- TABLES
-- ============================================================

-- Shops: one per owner account
CREATE TABLE shops (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  code                TEXT        NOT NULL UNIQUE,  -- e.g. 'CAPE99' — used for teller login
  whatsapp_number     TEXT,                         -- E.164 format, e.g. +27821234567
  low_stock_threshold INT         NOT NULL DEFAULT 5,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shops_code_format CHECK (code ~ '^[A-Z0-9]{6,10}$')
);

-- Maps Supabase Auth users to shops with a role
CREATE TABLE shop_users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('owner', 'teller')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, user_id)
);
CREATE INDEX idx_shop_users_user_id ON shop_users(user_id);

-- Named tellers — no auth account required; optionally linked to one
-- Owner is always present in this table (added during onboarding)
CREATE TABLE tellers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  user_id    UUID        REFERENCES auth.users(id),  -- NULL if teller has no own login
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)   -- display name unique within a shop
);
CREATE INDEX idx_tellers_shop_id ON tellers(shop_id);

-- Products
CREATE TABLE products (
  id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID           NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  barcode    TEXT           NOT NULL,
  name       TEXT           NOT NULL,
  price      NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock_qty  INT            NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  created_at TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE (shop_id, barcode)
);
CREATE INDEX idx_products_shop_barcode ON products(shop_id, barcode);

-- Sales — one record per completed transaction
CREATE TABLE sales (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID           NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  teller_id    UUID           REFERENCES tellers(id),
  total        NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  completed_at TIMESTAMPTZ    NOT NULL DEFAULT now(),
  synced_at    TIMESTAMPTZ,                -- NULL = came from offline queue, not yet confirmed
  offline_id   TEXT                        -- local IndexedDB ID used for dedup on sync
);
CREATE INDEX idx_sales_shop_id       ON sales(shop_id);
CREATE INDEX idx_sales_teller_id     ON sales(teller_id);
CREATE INDEX idx_sales_completed_at  ON sales(completed_at);

-- Sale line items
CREATE TABLE sale_items (
  id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id    UUID           NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID           NOT NULL REFERENCES products(id),
  quantity   INT            NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal   NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0)
);
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);

-- Stock take entries — audit log of every stock count
CREATE TABLE stock_take_entries (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id UUID        NOT NULL REFERENCES products(id),
  qty_before INT         NOT NULL,
  qty_after  INT         NOT NULL CHECK (qty_after >= 0),
  teller_id  UUID        REFERENCES tellers(id),
  taken_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_take_shop_id ON stock_take_entries(shop_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE shops               ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tellers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_take_entries  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS HELPER FUNCTIONS
-- ============================================================

-- Returns true if the current authenticated user belongs to the given shop
CREATE OR REPLACE FUNCTION user_in_shop(shop UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM shop_users
    WHERE shop_id = shop
      AND user_id = auth.uid()
  );
$$;

-- Returns true if the current authenticated user is the owner of the given shop
CREATE OR REPLACE FUNCTION user_is_owner(shop UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM shop_users
    WHERE shop_id = shop
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- shops
CREATE POLICY "shop_select"
  ON shops FOR SELECT
  USING (user_in_shop(id));

CREATE POLICY "shop_update"
  ON shops FOR UPDATE
  USING (user_is_owner(id));

-- shop_users
CREATE POLICY "shop_users_select"
  ON shop_users FOR SELECT
  USING (user_in_shop(shop_id));

CREATE POLICY "owner_manage_shop_users"
  ON shop_users FOR ALL
  USING (user_is_owner(shop_id));

-- tellers
CREATE POLICY "tellers_select"
  ON tellers FOR SELECT
  USING (user_in_shop(shop_id));

CREATE POLICY "owner_manage_tellers"
  ON tellers FOR ALL
  USING (user_is_owner(shop_id));

-- products
CREATE POLICY "shop_products"
  ON products FOR ALL
  USING (user_in_shop(shop_id));

-- sales
CREATE POLICY "shop_sales"
  ON sales FOR ALL
  USING (user_in_shop(shop_id));

-- sale_items (derived from sales.shop_id)
CREATE POLICY "shop_sale_items"
  ON sale_items FOR ALL
  USING (
    sale_id IN (
      SELECT id FROM sales WHERE user_in_shop(shop_id)
    )
  );

-- stock_take_entries
CREATE POLICY "shop_stock_take"
  ON stock_take_entries FOR ALL
  USING (user_in_shop(shop_id));
