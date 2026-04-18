-- Phase 30b: Traceability — Link Suppliers to Products & Goods Received Log
-- Records every stock top-up so inspectors can trace any item back to the
-- supplier it came from. Text-only audit trail.

-- 1. Last-known supplier on the product (for convenient defaulting + display)
ALTER TABLE products ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;
CREATE INDEX idx_products_supplier ON products(supplier_id);

-- 2. Goods Received log — one row per stock top-up event
CREATE TABLE goods_received (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id   UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id  UUID        REFERENCES suppliers(id) ON DELETE SET NULL,
  quantity     INT         NOT NULL CHECK (quantity > 0),
  notes        TEXT,
  received_by  UUID,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goods_received_shop ON goods_received(shop_id);
CREATE INDEX idx_goods_received_product ON goods_received(product_id);
CREATE INDEX idx_goods_received_supplier ON goods_received(supplier_id);
CREATE INDEX idx_goods_received_received_at ON goods_received(received_at DESC);

ALTER TABLE goods_received ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_goods_received_all"
  ON goods_received
  FOR ALL
  USING (user_in_shop(shop_id));
