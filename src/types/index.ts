// ============================================================
// SpazaSync — Shared TypeScript Types
// ============================================================

// --- Database row types ---

export type UserRole = 'owner' | 'teller'

export interface Shop {
  id: string
  name: string
  code: string
  whatsapp_number: string | null
  low_stock_threshold: number
  created_at: string
}

export interface ShopUser {
  id: string
  shop_id: string
  user_id: string
  role: UserRole
  created_at: string
}

export interface Teller {
  id: string
  shop_id: string
  name: string
  user_id: string | null
  active: boolean
  created_at: string
}

export interface Product {
  id: string
  shop_id: string
  barcode: string
  name: string
  price: number   // stored as NUMERIC, parsed as number (ZAR rands)
  stock_qty: number
  created_at: string
}

export interface Sale {
  id: string
  shop_id: string
  teller_id: string | null
  total: number
  completed_at: string
  synced_at: string | null
  offline_id: string | null
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface StockTakeEntry {
  id: string
  shop_id: string
  product_id: string
  qty_before: number
  qty_after: number
  teller_id: string | null
  taken_at: string
}

// --- Cart (in-memory, not persisted to DB until sale complete) ---

export interface CartItem {
  product: Product
  quantity: number
  subtotal: number
}

export interface Cart {
  items: CartItem[]
  teller_id: string | null
  total: number
}

// --- Offline queue (stored in IndexedDB) ---

export interface PendingSale {
  offline_id: string       // UUID generated locally
  shop_id: string
  teller_id: string | null
  total: number
  items: OfflineSaleItem[]
  queued_at: string
  retry_count: number
}

export interface OfflineSaleItem {
  product_id: string
  barcode: string
  quantity: number
  unit_price: number
  subtotal: number
}

// --- API request/response shapes ---

export interface CreateProductInput {
  barcode: string
  name: string
  price: number
  stock_qty?: number
}

export interface CompleteSaleInput {
  teller_id: string | null
  items: {
    product_id: string
    quantity: number
    unit_price: number
  }[]
  offline_id?: string
}

export interface StockTakeInput {
  product_id: string
  qty_after: number
  teller_id?: string | null
}

export interface CreateTellerInput {
  name: string
  password: string
}

// --- Auth session context ---

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  shop_id: string
  teller_id: string | null   // set if role === 'teller'; used to auto-select on sale page
}
