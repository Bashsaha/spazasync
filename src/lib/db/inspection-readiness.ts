/**
 * Phase 37c — single source of truth for the 7-check inspection-readiness panel.
 *
 * Originally inlined in [src/app/(app)/inspection/page.tsx]. Extracted so the
 * Compliance Journey Hub Step 2 (Health Certificate) can render the same panel
 * without duplicating the queries or risking drift between the two surfaces.
 *
 * Returns an `InspectionReadinessResult` whose `checks[].key` field is an i18n
 * key in the `inspection` namespace — the panel does the lookup so the data
 * layer stays free of i18n concerns.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'
import { computeDocumentStatus } from '@/lib/compliance/document-status'
import { isPestOverdue } from '@/lib/compliance/waste-pest-status'
import { getComplianceScore } from '@/lib/db/compliance-score'
import type {
  BusinessDocument,
  DailyChecklist,
  InspectionReadinessCheck,
  InspectionReadinessResult,
} from '@/types'

export async function getInspectionReadiness(
  supabase: SupabaseClient,
  shopId: string,
  documents: BusinessDocument[],
): Promise<InspectionReadinessResult> {
  const today = formatInTimeZone(new Date(), SAST_TZ, 'yyyy-MM-dd')
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const weekFromDate = formatInTimeZone(sevenDaysAgo, SAST_TZ, 'yyyy-MM-dd')

  const [{ result: score }, todayChecklistResult, weekChecklistResult, pestResult] =
    await Promise.all([
      getComplianceScore(supabase, shopId),
      supabase
        .from('daily_checklists')
        .select('id,fridge_temp,freezer_temp')
        .eq('shop_id', shopId)
        .eq('date', today)
        .maybeSingle(),
      supabase
        .from('daily_checklists')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .gte('date', weekFromDate),
      supabase
        .from('pest_control_logs')
        .select('visit_date')
        .eq('shop_id', shopId)
        .order('visit_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  const docSummary = computeDocumentStatus(documents, today)
  const expiredTypes = new Set(docSummary.expired.map((d) => d.document_type))
  const missingTypes = new Set(docSummary.missing)

  const municipalDoc = documents.find((d) => d.document_type === 'municipal_registration')
  const coaDoc = documents.find((d) => d.document_type === 'coa')

  const municipalOk =
    !!municipalDoc &&
    !missingTypes.has('municipal_registration') &&
    !expiredTypes.has('municipal_registration') &&
    municipalDoc.status !== 'pending' &&
    municipalDoc.status !== 'not_registered' &&
    municipalDoc.status !== 'in_progress'

  const coaOk =
    !!coaDoc &&
    !missingTypes.has('coa') &&
    !expiredTypes.has('coa') &&
    coaDoc.status !== 'pending' &&
    coaDoc.status !== 'not_registered' &&
    coaDoc.status !== 'expired' &&
    coaDoc.status !== 'in_progress'

  const checklistsThisWeek = weekChecklistResult.count ?? 0
  const checklistWeekOk = checklistsThisWeek >= 5

  const expiryCategory = score.categories.find((c) => c.key === 'expiry')
  const noExpiredOk = expiryCategory ? expiryCategory.score === 100 : true

  const supplierCategory = score.categories.find((c) => c.key === 'suppliers')
  const suppliersOk = supplierCategory ? supplierCategory.score >= 80 : true

  const lastPestVisit =
    (pestResult.data as { visit_date: string } | null)?.visit_date ?? null
  const pestOk = !isPestOverdue(lastPestVisit, today)

  const todayChecklist =
    (todayChecklistResult.data as
      | Pick<DailyChecklist, 'id' | 'fridge_temp' | 'freezer_temp'>
      | null) ?? null
  const tempLoggedToday =
    !!todayChecklist &&
    (todayChecklist.fridge_temp !== null || todayChecklist.freezer_temp !== null)

  const checks: InspectionReadinessCheck[] = [
    { key: 'pc_municipal', pass: municipalOk, fixHref: '/documents/municipal_registration' },
    { key: 'pc_coa', pass: coaOk, fixHref: '/documents/coa' },
    { key: 'pc_checklist_week', pass: checklistWeekOk, fixHref: '/checklist' },
    { key: 'pc_suppliers', pass: suppliersOk, fixHref: '/products' },
    { key: 'pc_no_expired', pass: noExpiredOk, fixHref: '/expiry' },
    { key: 'pc_pest', pass: pestOk, fixHref: '/waste-pest/pest/new' },
    { key: 'pc_temp_today', pass: tempLoggedToday, fixHref: '/checklist' },
  ]

  return {
    checks,
    passing: checks.filter((c) => c.pass).length,
    total: checks.length,
  }
}
