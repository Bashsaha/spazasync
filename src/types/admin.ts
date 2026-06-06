// ============================================================
// Movestock — Admin dashboard types
// ============================================================

import type { SubscriptionStatus } from './core'

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

export interface AdminOverviewStats {
  totalShops: number
  activeShops: number
  trialingShops: number
  expiredShops: number
  manualOverrideShops: number
  recentSignUps: number
}
