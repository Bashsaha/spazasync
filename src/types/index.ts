// ============================================================
// SpazaSync — Shared TypeScript Types
// ============================================================

// --- Database row types ---

export type UserRole = 'owner' | 'teller' | 'admin'

export type SubscriptionStatus = 'trialing' | 'active' | 'cancelled' | 'expired' | 'manual_override'

export interface Shop {
  id: string
  name: string
  code: string
  whatsapp_number: string | null
  low_stock_threshold: number
  registration_number: string | null
  location: string | null
  subscription_status: SubscriptionStatus
  trial_ends_at: string | null
  subscription_ends_at: string | null
  access_granted: boolean
  admin_notes: string | null
  created_at: string
}

export interface SubscriptionInfo {
  status: SubscriptionStatus
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
  daysRemaining: number | null
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
  barcode: string | null
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
  last_error?: string      // reason for last sync failure
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

// --- Reporting ---

export interface DailySummaryData {
  salesCount: number
  totalRevenue: number
  topItems: Array<{ name: string; totalQty: number }>
  tellerCount: number
}

export interface LowStockItem {
  name: string
  stock_qty: number
}

export interface WeeklyDataPoint {
  label: string        // short day name, e.g. "Mon"
  date: string         // yyyy-MM-dd
  revenue: number
  salesCount: number
}

export interface RecentSale {
  id: string
  total: number
  completed_at: string
  teller_name: string | null
}

export interface TopProduct {
  name: string
  totalQty: number
  totalRevenue: number
}

// --- Auth session context ---

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  shop_id: string
  teller_id: string | null   // set if role === 'teller'; used to auto-select on sale page
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

// --- Shared barcode catalog ---

export interface BarcodeCatalogEntry {
  id: string
  barcode: string
  name: string
  category: string | null
  created_at: string
  updated_at: string
}

// --- Admin dashboard ---

export interface AdminPayment {
  id: string
  shop_id: string
  amount: number
  method: 'eft' | 'cash' | 'card' | 'other'
  reference: string | null
  notes: string | null
  recorded_by: string
  recorded_at: string
}

export interface AdminShopListItem {
  id: string
  name: string
  code: string
  whatsapp_number: string | null
  subscription_status: SubscriptionStatus
  access_granted: boolean
  created_at: string
  owner_email: string | null
  last_payment_at: string | null
}

export interface StockMovementEntry {
  date: string // YYYY-MM-DD
  product_name: string
  type: 'sale' | 'adjustment'
  delta: number
  reason: string | null
}

export interface ExpiringProductAlert {
  name: string
  expired_qty: number
  expiring_soon_qty: number
  earliest_expiry: string // YYYY-MM-DD
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

export interface ShopProduct {
  id: string
  name: string
  barcode: string | null
  price: number
  stock_qty: number
}

export interface AdminOverviewStats {
  totalShops: number
  activeShops: number
  trialingShops: number
  expiredShops: number
  manualOverrideShops: number
  recentSignUps: number
}
