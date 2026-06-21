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
  /** Total of all admin_payments amounts recorded this calendar month (SAST), in ZAR. */
  revenueThisMonth: number
  /** Total of all admin_payments amounts ever recorded, in ZAR. */
  revenueAllTime: number
}

// ── Field Sales / shop-visit CRM (Phase 51) ─────────────────────────────────

export const LEAD_STATUSES = [
  'prospect',
  'contacted',
  'interested',
  'signed',
  'not_interested',
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const VISIT_OUTCOMES = [
  'left_info',
  'demo_given',
  'callback',
  'signed',
  'not_interested',
  'no_answer',
  'other',
] as const
export type VisitOutcome = (typeof VISIT_OUTCOMES)[number]

export interface Lead {
  id: string
  business_name: string
  owner_name: string | null
  phone: string | null
  whatsapp_number: string | null
  address: string | null
  area: string | null
  status: LeadStatus
  notes: string | null
  shop_id: string | null
  next_follow_up_at: string | null // YYYY-MM-DD
  next_follow_up_note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** A lead row enriched with visit aggregates for list / area views. */
export interface LeadListItem extends Lead {
  visit_count: number
  last_visited_at: string | null
}

export interface ShopVisit {
  id: string
  lead_id: string
  visited_at: string
  notes: string | null
  outcome: VisitOutcome | null
  visited_by: string | null
  created_at: string
}

export interface LeadDetail extends Lead {
  visits: ShopVisit[]
}

/** One bucket on the area / map view. */
export interface AreaGroup {
  area: string
  total: number
  visited: number // leads with at least one logged visit
  signed: number
}
