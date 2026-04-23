import type { SupabaseClient } from '@supabase/supabase-js'
import { computeChecklistStats } from '@/lib/checklist/stats'
import { computeDocumentStatus } from '@/lib/compliance/document-status'
import {
  isPestOverdue,
  isWasteConfirmationStale,
} from '@/lib/compliance/waste-pest-status'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'
import { computeComplianceScore } from '@/lib/compliance/score'
import type {
  BusinessDocument,
  ComplianceScoreInputs,
  ComplianceScoreResult,
  DailyChecklist,
} from '@/types'

/**
 * Resolve the compliance score for a shop from live DB state.
 * Uses the passed-in supabase client (so the caller controls RLS scoping).
 */
export async function getComplianceScore(
  supabase: SupabaseClient,
  shopId: string,
): Promise<{ inputs: ComplianceScoreInputs; result: ComplianceScoreResult }> {
  const today = formatInTimeZone(new Date(), SAST_TZ, 'yyyy-MM-dd')

  const checklistFrom = new Date()
  checklistFrom.setDate(checklistFrom.getDate() - 29)
  const checklistFromDate = formatInTimeZone(checklistFrom, SAST_TZ, 'yyyy-MM-dd')

  const [
    checklistResult,
    documentsResult,
    expiredBatchesResult,
    productTotalsResult,
    productsWithSupplierResult,
    lastPestResult,
    wasteResult,
  ] = await Promise.all([
    supabase
      .from('daily_checklists')
      .select('*')
      .eq('shop_id', shopId)
      .gte('date', checklistFromDate),

    supabase
      .from('business_documents')
      .select('*')
      .eq('shop_id', shopId),

    supabase
      .from('product_batches')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .gt('quantity', 0)
      .lt('expiry_date', today),

    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId),

    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .not('supplier_id', 'is', null),

    supabase
      .from('pest_control_logs')
      .select('visit_date')
      .eq('shop_id', shopId)
      .order('visit_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('waste_management')
      .select('last_confirmed_date')
      .eq('shop_id', shopId)
      .maybeSingle(),
  ])

  const checklistRows = (checklistResult.data as DailyChecklist[] | null) ?? []
  const checklistStats = computeChecklistStats(checklistRows, 30)

  const businessDocuments = (documentsResult.data as BusinessDocument[] | null) ?? []
  const docSummary = computeDocumentStatus(businessDocuments, today)

  const expiredBatchCount = expiredBatchesResult.count ?? 0
  const productCount = productTotalsResult.count ?? 0
  const productsWithSupplier = productsWithSupplierResult.count ?? 0

  const lastPestVisit =
    (lastPestResult.data as { visit_date: string } | null)?.visit_date ?? null
  const lastWasteConfirmed =
    (wasteResult.data as { last_confirmed_date: string | null } | null)
      ?.last_confirmed_date ?? null

  const inputs: ComplianceScoreInputs = {
    checklistCompliancePct: checklistStats.compliancePct,
    expiredBatchCount,
    productCount,
    productsWithSupplier,
    documentOverall: docSummary.overall,
    pestOverdue: isPestOverdue(lastPestVisit, today),
    wasteStale: isWasteConfirmationStale(lastWasteConfirmed, today),
  }

  return { inputs, result: computeComplianceScore(inputs) }
}
