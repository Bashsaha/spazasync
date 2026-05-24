/**
 * Phase 37g — composite reader for the dashboard reminder banner.
 *
 * Resolves every input the pure evaluator needs in one batched call, picks
 * the top-priority reminder, then UPSERTs `shown_at` for that key (best-effort
 * — failure to write is silently ignored; the reminder still renders).
 */

import { formatInTimeZone } from 'date-fns-tz'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SAST_TZ } from '@/lib/utils/date'
import { getComplianceScore } from '@/lib/db/compliance-score'
import { getChecklistStreakStatus } from '@/lib/db/daily-checklist'
import { generateJourneySteps } from '@/lib/compliance/journey'
import { computeFundReadiness } from '@/lib/compliance/fund'
import { evaluateReminders, sortByPriority, pickTopReminder } from '@/lib/compliance/reminders'
import { getShopForRequest } from '@/lib/db/shop'
import type {
  AdminAlert,
  BusinessDocument,
  ComplianceReminderRow,
  OwnerProfile,
  Reminder,
  Shop,
} from '@/types'

export async function getDashboardReminder(
  shopId: string,
  userId: string,
): Promise<Reminder | null> {
  const supabase = await createClient()
  const todayISO = formatInTimeZone(new Date(), SAST_TZ, 'yyyy-MM-dd')

  // Active admin alerts use a public-readable RLS policy gated by
  // starts_at/expires_at; a normal client read is fine.
  const [
    shopRow,
    ownerProfileResult,
    documentsResult,
    scoreResult,
    streakResult,
    alertsResult,
    ledgerResult,
    missingCostResult,
    missingSupplierResult,
    suppliersCountResult,
  ] = await Promise.all([
    // Shared, request-memoised shop fetch — the layout already paid for this.
    getShopForRequest(shopId, supabase),
    supabase
      .from('owner_profiles')
      .select('user_id, nationality_type, food_safety_training_completed, food_safety_training_date, food_safety_training_provider, has_disability, visa_type, visa_expiry_date, naturalised_pre_1994, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('business_documents')
      .select('id, shop_id, document_type, status, reference_number, date_issued, expiry_date, notes, applied_at, created_at, updated_at')
      .eq('shop_id', shopId)
      .order('document_type'),
    getComplianceScore(supabase, shopId),
    getChecklistStreakStatus(shopId),
    supabase
      .from('admin_alerts')
      .select('id, title, message, link_text, link_url, priority, target_audience, starts_at, expires_at')
      .order('priority', { ascending: false }),
    supabase
      .from('compliance_reminders')
      .select('id, shop_id, reminder_type, reminder_key, shown_at, dismissed_at')
      .eq('shop_id', shopId),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .is('cost_price', null),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .is('supplier_id', null),
    supabase
      .from('suppliers')
      .select('id', { count: 'exact', head: true }),
  ])

  if (!shopRow) return null
  const shop = {
    has_employees: shopRow.has_employees ?? false,
    fund_interest: shopRow.fund_interest ?? false,
    fund_township_rural: shopRow.fund_township_rural ?? null,
    fund_owner_managed: shopRow.fund_owner_managed ?? null,
  }

  const ownerProfile = (ownerProfileResult.data as OwnerProfile | null) ?? null
  const documents = (documentsResult.data as BusinessDocument[] | null) ?? []
  const adminAlerts = (alertsResult.data as AdminAlert[] | null) ?? []
  const ledger = (ledgerResult.data as ComplianceReminderRow[] | null) ?? []

  const journeySteps = generateJourneySteps(
    ownerProfile,
    { has_employees: shop.has_employees, fund_interest: shop.fund_interest },
    documents,
  )

  // Last journey activity = max(business_documents.updated_at).
  const lastJourneyActivity =
    documents
      .map((d) => d.updated_at)
      .filter(Boolean)
      .sort()
      .pop() ?? null

  // Fund "qualified" mirrors the green verdict from the existing engine. Only
  // meaningful for SA citizens with fund_interest — `computeFundReadiness`
  // handles the gate when called with `fund_interest: false` (returns red).
  const fundReadiness = computeFundReadiness({
    nationality_type: ownerProfile?.nationality_type ?? null,
    fund_interest: shop.fund_interest,
    fund_township_rural: shop.fund_township_rural,
    fund_owner_managed: shop.fund_owner_managed,
    documents,
    complianceScore: scoreResult.result.overall,
  })
  const fundQualified = fundReadiness.status === 'green'

  // The streak reader returns Infinity when there's no checklist row yet.
  // Cap at a sentinel large enough to trigger the streak reminder once the
  // shop has been onboarded — but keep it finite so JSON serialisation works.
  const daysSinceChecklist = Number.isFinite(streakResult.daysSinceLastCompleted)
    ? streakResult.daysSinceLastCompleted
    : 999

  const top = pickTopReminder({
    todayISO,
    ownerProfile,
    shop: { has_employees: shop.has_employees, fund_interest: shop.fund_interest },
    documents,
    journeySteps,
    lastJourneyActivity,
    complianceScore: scoreResult.result.overall,
    scoreBand: scoreResult.result.band,
    daysSinceChecklist,
    checklistCompletedToday: streakResult.completedToday,
    adminAlerts,
    ledger,
    fundQualified,
    productsMissingCost: missingCostResult.count ?? 0,
    productsMissingSupplier: missingSupplierResult.count ?? 0,
    suppliersCount: suppliersCountResult.count ?? 0,
  })

  if (!top) return null

  // Best-effort UPSERT to record `shown_at`. Ignore failures — the user still
  // sees the banner, and the next render will retry the insert.
  void recordShown(shopId, top).catch(() => {})

  return top
}

/**
 * Same composite read as `getDashboardReminder`, but returns the FULL sorted
 * list of non-dismissed reminders (highest priority first). Used by the
 * notification bell so the owner can see every active reminder, not just the
 * top one. Skips the `shown_at` upsert — the bell is a passive read.
 */
export async function listDashboardReminders(
  shopId: string,
  userId: string,
): Promise<Reminder[]> {
  const supabase = await createClient()
  const todayISO = formatInTimeZone(new Date(), SAST_TZ, 'yyyy-MM-dd')

  const [
    shopRow,
    ownerProfileResult,
    documentsResult,
    scoreResult,
    streakResult,
    alertsResult,
    ledgerResult,
    missingCostResult,
    missingSupplierResult,
    suppliersCountResult,
  ] = await Promise.all([
    getShopForRequest(shopId, supabase),
    supabase
      .from('owner_profiles')
      .select('user_id, nationality_type, food_safety_training_completed, food_safety_training_date, food_safety_training_provider, has_disability, visa_type, visa_expiry_date, naturalised_pre_1994, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('business_documents')
      .select('id, shop_id, document_type, status, reference_number, date_issued, expiry_date, notes, applied_at, created_at, updated_at')
      .eq('shop_id', shopId)
      .order('document_type'),
    getComplianceScore(supabase, shopId),
    getChecklistStreakStatus(shopId),
    supabase
      .from('admin_alerts')
      .select('id, title, message, link_text, link_url, priority, target_audience, starts_at, expires_at')
      .order('priority', { ascending: false }),
    supabase
      .from('compliance_reminders')
      .select('id, shop_id, reminder_type, reminder_key, shown_at, dismissed_at')
      .eq('shop_id', shopId),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .is('cost_price', null),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .is('supplier_id', null),
    supabase
      .from('suppliers')
      .select('id', { count: 'exact', head: true }),
  ])

  if (!shopRow) return []
  const shop = {
    has_employees: shopRow.has_employees ?? false,
    fund_interest: shopRow.fund_interest ?? false,
    fund_township_rural: shopRow.fund_township_rural ?? null,
    fund_owner_managed: shopRow.fund_owner_managed ?? null,
  }

  const ownerProfile = (ownerProfileResult.data as OwnerProfile | null) ?? null
  const documents = (documentsResult.data as BusinessDocument[] | null) ?? []
  const adminAlerts = (alertsResult.data as AdminAlert[] | null) ?? []
  const ledger = (ledgerResult.data as ComplianceReminderRow[] | null) ?? []

  const journeySteps = generateJourneySteps(
    ownerProfile,
    { has_employees: shop.has_employees, fund_interest: shop.fund_interest },
    documents,
  )

  const lastJourneyActivity =
    documents
      .map((d) => d.updated_at)
      .filter(Boolean)
      .sort()
      .pop() ?? null

  const fundReadiness = computeFundReadiness({
    nationality_type: ownerProfile?.nationality_type ?? null,
    fund_interest: shop.fund_interest,
    fund_township_rural: shop.fund_township_rural,
    fund_owner_managed: shop.fund_owner_managed,
    documents,
    complianceScore: scoreResult.result.overall,
  })
  const fundQualified = fundReadiness.status === 'green'

  const daysSinceChecklist = Number.isFinite(streakResult.daysSinceLastCompleted)
    ? streakResult.daysSinceLastCompleted
    : 999

  const inputs = {
    todayISO,
    ownerProfile,
    shop: { has_employees: shop.has_employees, fund_interest: shop.fund_interest },
    documents,
    journeySteps,
    lastJourneyActivity,
    complianceScore: scoreResult.result.overall,
    scoreBand: scoreResult.result.band,
    daysSinceChecklist,
    checklistCompletedToday: streakResult.completedToday,
    adminAlerts,
    ledger,
    fundQualified,
    productsMissingCost: missingCostResult.count ?? 0,
    productsMissingSupplier: missingSupplierResult.count ?? 0,
    suppliersCount: suppliersCountResult.count ?? 0,
  }

  const dismissedKeys = new Set(
    ledger.filter((row) => row.dismissed_at !== null).map((row) => row.reminder_key),
  )
  const all = evaluateReminders(inputs).filter((r) => !dismissedKeys.has(r.key))
  return sortByPriority(all)
}

async function recordShown(shopId: string, reminder: Reminder): Promise<void> {
  // Use the admin client so the row write doesn't fight RLS in edge cases
  // where the user's session has been refreshed mid-render.
  const admin = createAdminClient()
  const now = new Date().toISOString()
  await admin
    .from('compliance_reminders')
    .upsert(
      {
        shop_id: shopId,
        reminder_type: reminder.type,
        reminder_key: reminder.key,
        shown_at: now,
      },
      { onConflict: 'shop_id,reminder_key', ignoreDuplicates: false },
    )
}
