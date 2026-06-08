// ============================================================
// Movestock — Products, stock, batches, suppliers, goods received
// ============================================================

export interface Product {
  id: string
  shop_id: string
  barcode: string | null
  name: string
  price: number   // stored as NUMERIC, parsed as number (ZAR rands)
  cost_price: number | null   // wholesale / buy-in cost per unit — nullable
  stock_qty: number
  supplier_id: string | null  // last-known supplier (Phase 30b)
  created_at: string
  track_stock?: boolean   // Phase 47 — false = never deducts stock (e.g. the catch-all)
  is_catch_all?: boolean  // Phase 47 — true for the per-shop "No-name product"
}

export interface CreateProductInput {
  barcode: string
  name: string
  price: number
  cost_price?: number | null
  stock_qty?: number
  supplier_id?: string | null
}

export interface ShopProduct {
  id: string
  name: string
  barcode: string | null
  price: number
  stock_qty: number
}

// --- Shared barcode catalog ---

export interface BarcodeCatalogEntry {
  id: string
  barcode: string
  name: string
  category: string | null
  created_at: string
  updated_at: string
}

// --- Product batches (expiry tracking) ---

export interface ProductBatch {
  id: string
  shop_id: string
  product_id: string
  expiry_date: string   // DATE as YYYY-MM-DD
  quantity: number
  created_at: string
}

export interface AddBatchInput {
  product_id: string
  expiry_date: string   // YYYY-MM-DD
  quantity: number
}

// --- Expiry page (Phase 19a) ---

export interface BatchDetail {
  id: string
  expiry_date: string   // YYYY-MM-DD
  quantity: number
  status: 'expired' | 'expiring_soon' | 'ok'
}

export interface ExpiryProductDetail {
  product_id: string
  product_name: string
  barcode: string | null
  stock_qty: number
  urgency: 'expired' | 'expiring_soon' | 'ok'
  batches: BatchDetail[]
}

// --- Sale batch consumption audit (Phase 19b) ---

export interface SaleBatchConsumption {
  id: string
  sale_id: string
  batch_id: string
  product_id: string
  qty_consumed: number
  expiry_date: string   // DATE as YYYY-MM-DD
  created_at: string
}

// --- Stock take + adjustments ---

export interface StockTakeEntry {
  id: string
  shop_id: string
  product_id: string
  qty_before: number
  qty_after: number
  teller_id: string | null
  taken_at: string
}

export interface StockTakeInput {
  product_id: string
  qty_after: number
  teller_id?: string | null
  /** Why the count is lower than current stock (unsure | damaged_expired | miscount | other). */
  reason?: string | null
}

export interface StockAdjustment {
  id: string
  shop_id: string
  product_id: string
  qty_before: number
  qty_after: number
  delta: number
  reason: string | null
  adjusted_by: string | null
  adjusted_at: string
}

export interface StockAdjustInput {
  product_id: string
  qty_delta: number
  reason?: string
}

// --- Suppliers (Phase 30a) ---

export type SupplierType = 'wholesaler' | 'distributor' | 'farmer' | 'other'

export interface Supplier {
  id: string
  shop_id: string
  name: string
  contact_number: string | null
  type: SupplierType | null
  location: string | null
  created_at: string
}

export interface CreateSupplierInput {
  name: string
  contact_number?: string | null
  type?: SupplierType | null
  location?: string | null
}

// --- Goods received (Phase 30b) ---

export interface GoodsReceived {
  id: string
  shop_id: string
  product_id: string
  supplier_id: string | null
  quantity: number
  notes: string | null
  received_by: string | null
  received_at: string
}

export interface CreateGoodsReceivedInput {
  product_id: string
  quantity: number
  supplier_id?: string | null
  notes?: string | null
}

/** Goods received row joined with product + supplier names (for list/reports). */
export interface GoodsReceivedWithNames extends GoodsReceived {
  product_name: string
  supplier_name: string | null
}
