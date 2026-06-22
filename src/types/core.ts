// ============================================================
// Movestock — Core entity & session types
// (shops, users, tellers, auth session)
// ============================================================

import type { SupportedLocale } from '@/lib/i18n/types'

export type UserRole = 'owner' | 'teller' | 'admin'

// 'processing_cancellation' is the 4-day grace window between a subscription's
// end date and full expiry (Phase 54). It is set ONLY by the daily cron
// (expire_due_shops) — never chosen by an admin — so it is intentionally absent
// from adminUpdateSubscriptionSchema's enum.
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'cancelled'
  | 'expired'
  | 'manual_override'
  | 'processing_cancellation'

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
  language: SupportedLocale
  access_granted: boolean
  admin_notes: string | null
  profit_tracking_enabled: boolean
  has_fridge: boolean
  has_freezer: boolean
  // Phase 37b — Compliance Onboarding
  municipality_id: string | null
  municipality_area_text: string | null
  has_employees: boolean
  fund_interest: boolean
  onboarding_compliance_completed: boolean
  onboarding_compliance_dismissed_at: string | null
  onboarding_compliance_dismiss_count: number
  // Phase 37e — Fund Readiness Checker
  fund_township_rural: boolean | null
  fund_owner_managed: boolean | null
  // Phase 41a — SARS six-month transitional period for fund eligibility.
  // After this date, sars_tax must be valid/on_file for fund readiness.
  sars_grace_period_until: string | null  // YYYY-MM-DD
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
  // Phase 37c — Step 6 (Food Safety) per-staff training tracker.
  food_safety_trained_at: string | null
  created_at: string
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
