// ============================================================
// Movestock — Sales, cart, offline queue, sales reporting
// ============================================================

import type { Product } from './products'

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
  unit_cost: number | null   // snapshot of product.cost_price at sale time
  subtotal: number
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

// --- Reporting ---

export interface DailySummaryData {
  salesCount: number
  totalRevenue: number
  totalProfit: number           // sum of (unit_price - unit_cost) * qty where unit_cost IS NOT NULL
  hasProfitData: boolean        // true iff at least one sale_item this period had a non-null unit_cost
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

// --- Sales history (Phase 35a) ---

export interface SaleItemWithProduct {
  id: string
  product_id: string
  product_name: string
  product_barcode: string | null
  quantity: number
  unit_price: number
  unit_cost: number | null
  subtotal: number
  /** (unit_price − unit_cost) * quantity — null when unit_cost is null */
  line_profit: number | null
}

export interface SaleWithDetails {
  id: string
  total: number
  completed_at: string
  teller_id: string | null
  teller_name: string | null
  items: SaleItemWithProduct[]
  /** Σ(line_profit) across items — null if ANY line has null unit_cost and profit tracking is on */
  profit: number | null
}

export interface DailySalesTotals {
  saleCount: number
  revenue: number
  /** null when profit tracking off OR when any sale that day has missing cost data */
  profit: number | null
  uniqueTellers: number
}

export interface TopProduct {
  name: string
  totalQty: number
  totalRevenue: number
}
