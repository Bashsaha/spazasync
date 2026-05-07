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
import { pickTopReminder } from '@/lib/compliance/reminders'
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
    shopResult,
    ownerProfileResult,
    documentsResult,
    scoreResult,
    streakResult,
    alertsResult,
    ledgerResult,
  ] = await Promise.all([
    supabase
      .from('shops')
      .select('id, has_employees, fund_interest, fund_township_rural, fund_owner_managed')
      .eq('id', shopId)
      .maybeSingle(),
    supabase
      .from('owner_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('business_documents')
      .select('*')
      .eq('shop_id', shopId)
      .order('document_type'),
    getComplianceScore(supabase, shopId),
    getChecklistStreakStatus(shopId),
    supabase
      .from('admin_alerts')
      .select('*')
      .order('priority', { ascending: false }),
    supabase
      .from('compliance_reminders')
      .select('*')
      .eq('shop_id', shopId),
  ])

  const shop = shopResult.data as Pick<
    Shop,
    'id' | 'has_employees' | 'fund_interest' | 'fund_township_rural' | 'fund_owner_managed'
  > | null
  if (!shop) return null

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
  })

  if (!top) return null

  // Best-effort UPSERT to record `shown_at`. Ignore failures — the user still
  // sees the banner, and the next render will retry the insert.
  void recordShown(shopId, top).catch(() => {})

  return top
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
