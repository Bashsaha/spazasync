import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'
import type {
  StockMovementEntry,
  DailyChecklist,
  ChecklistStats,
  BusinessDocument,
  PestControlLog,
  WasteManagement,
  ComplianceScoreInputs,
  ComplianceScoreResult,
} from '@/types'
import { computeChecklistStats } from '@/lib/checklist/stats'
import { computeDocumentStatus } from '@/lib/compliance/document-status'
import { isPestOverdue, isWasteConfirmationStale } from '@/lib/compliance/waste-pest-status'
import { computeComplianceScore } from '@/lib/compliance/score'

export interface ComplianceReportData {
  shop: {
    name: string
    code: string
    registration_number: string | null
    location: string | null
  }
  inventory: Array<{
    name: string
    barcode: string | null
    price: number
    stock_qty: number
  }>
  expiryBatches: Array<{
    product_name: string
    expiry_date: string // YYYY-MM-DD
    quantity: number
  }>
  stockMovement: StockMovementEntry[]
  suppliers: Array<{
    name: string
    type: string | null
    contact_number: string | null
    location: string | null
  }>
  goodsReceived: Array<{
    date: string // YYYY-MM-DD in SAST
    product_name: string
    quantity: number
    supplier_name: string | null
    notes: string | null
  }>
  checklistHistory: DailyChecklist[]
  checklistStats: ChecklistStats
  hasFridge: boolean
  hasFreezer: boolean
  businessDocuments: BusinessDocument[]
  pestControlLogs: PestControlLog[]
  wasteManagement: WasteManagement | null
  wasteBinsCompliance: {
    totalDays: number
    okDays: number
    pct: number // 0–100
  }
  scoreInputs: ComplianceScoreInputs
  score: ComplianceScoreResult
  generatedAt: string // ISO string
}

/**
 * Fetch all data needed for the compliance PDF report.
 * Uses the authenticated user's Supabase client (RLS-scoped).
 */
export async function getComplianceReportData(shopId: string): Promise<ComplianceReportData> {
  const supabase = await createClient()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString()

  // Run all queries in parallel
  const checklistFrom = new Date()
  checklistFrom.setDate(checklistFrom.getDate() - 29)
  const checklistFromDate = formatInTimeZone(checklistFrom, SAST_TZ, 'yyyy-MM-dd')

  const todaySAST = formatInTimeZone(new Date(), SAST_TZ, 'yyyy-MM-dd')

  const [
    shopResult,
    productsResult,
    batchesResult,
    adjustmentsResult,
    salesResult,
    suppliersResult,
    goodsReceivedResult,
    checklistResult,
    businessDocumentsResult,
    pestControlLogsResult,
    wasteManagementResult,
    expiredBatchesCountResult,
    productsTotalCountResult,
    productsWithSupplierCountResult,
  ] = await Promise.all([
      // Shop info
      supabase
        .from('shops')
        .select('name, code, registration_number, location, has_fridge, has_freezer')
        .eq('id', shopId)
        .single(),

      // Current inventory
      supabase
        .from('products')
        .select('name, barcode, price, stock_qty')
        .eq('shop_id', shopId)
        .order('name', { ascending: true }),

      // All non-zero expiry batches (for the register)
      supabase
        .from('product_batches')
        .select('product_id, expiry_date, quantity, products(name)')
        .eq('shop_id', shopId)
        .gt('quantity', 0)
        .order('expiry_date', { ascending: true }),

      // Stock adjustments (last 30 days)
      supabase
        .from('stock_adjustments')
        .select('product_id, delta, reason, adjusted_at, products(name)')
        .eq('shop_id', shopId)
        .gte('adjusted_at', thirtyDaysAgoISO)
        .order('adjusted_at', { ascending: false }),

      // Sales with items (last 30 days)
      supabase
        .from('sales')
        .select('completed_at, sale_items(product_id, quantity, products(name))')
        .eq('shop_id', shopId)
        .gte('completed_at', thirtyDaysAgoISO)
        .order('completed_at', { ascending: false }),

      // Supplier directory
      supabase
        .from('suppliers')
        .select('name, type, contact_number, location')
        .eq('shop_id', shopId)
        .order('name', { ascending: true }),

      // Goods received (last 30 days) with product + supplier names
      supabase
        .from('goods_received')
        .select('received_at, quantity, notes, products(name), suppliers(name)')
        .eq('shop_id', shopId)
        .gte('received_at', thirtyDaysAgoISO)
        .order('received_at', { ascending: false }),

      // Daily checklists (last 30 days)
      supabase
        .from('daily_checklists')
        .select('*')
        .eq('shop_id', shopId)
        .gte('date', checklistFromDate)
        .order('date', { ascending: false }),

      // Business documents (all)
      supabase
        .from('business_documents')
        .select('*')
        .eq('shop_id', shopId)
        .order('document_type'),

      // Pest control logs (last 180 days)
      (async () => {
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180)
        const sixMonthsAgoDate = formatInTimeZone(sixMonthsAgo, SAST_TZ, 'yyyy-MM-dd')
        return supabase
          .from('pest_control_logs')
          .select('*')
          .eq('shop_id', shopId)
          .gte('visit_date', sixMonthsAgoDate)
          .order('visit_date', { ascending: false })
      })(),

      // Waste management singleton
      supabase
        .from('waste_management')
        .select('*')
        .eq('shop_id', shopId)
        .maybeSingle(),

      // Expired-batch count (batches with quantity > 0 AND expiry_date < today)
      supabase
        .from('product_batches')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .gt('quantity', 0)
        .lt('expiry_date', todaySAST),

      // Total products
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId),

      // Products with a supplier_id
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .not('supplier_id', 'is', null),
    ])

  if (shopResult.error) throw shopResult.error

  // Build inventory
  const inventory = (productsResult.data ?? []).map((p) => ({
    name: p.name,
    barcode: p.barcode,
    price: Number(p.price),
    stock_qty: p.stock_qty,
  }))

  // Build expiry register
  const expiryBatches = (batchesResult.data ?? []).map((b) => {
    const productRaw = b.products as unknown as { name: string } | null
    return {
      product_name: productRaw?.name ?? 'Unknown',
      expiry_date: b.expiry_date,
      quantity: b.quantity,
    }
  })

  // Build stock movement from adjustments
  const movements: StockMovementEntry[] = []

  for (const adj of adjustmentsResult.data ?? []) {
    const productRaw = adj.products as unknown as { name: string } | null
    movements.push({
      date: formatInTimeZone(new Date(adj.adjusted_at), SAST_TZ, 'yyyy-MM-dd'),
      product_name: productRaw?.name ?? 'Unknown',
      type: 'adjustment',
      delta: adj.delta,
      reason: adj.reason,
    })
  }

  // Build stock movement from sales
  for (const sale of salesResult.data ?? []) {
    const saleDate = formatInTimeZone(new Date(sale.completed_at), SAST_TZ, 'yyyy-MM-dd')
    const items = sale.sale_items as unknown as Array<{
      product_id: string
      quantity: number
      products: { name: string } | null
    }>
    for (const item of items ?? []) {
      movements.push({
        date: saleDate,
        product_name: item.products?.name ?? 'Unknown',
        type: 'sale',
        delta: -item.quantity,
        reason: null,
      })
    }
  }

  // Sort by date descending
  movements.sort((a, b) => b.date.localeCompare(a.date))

  // Build supplier directory
  const suppliers = (suppliersResult.data ?? []).map((s) => ({
    name: s.name,
    type: s.type,
    contact_number: s.contact_number,
    location: s.location,
  }))

  // Build goods received log
  const goodsReceived = (goodsReceivedResult.data ?? []).map((g) => {
    const productRaw = g.products as unknown as { name: string } | null
    const supplierRaw = g.suppliers as unknown as { name: string } | null
    return {
      date: formatInTimeZone(new Date(g.received_at), SAST_TZ, 'yyyy-MM-dd'),
      product_name: productRaw?.name ?? 'Unknown',
      quantity: g.quantity,
      supplier_name: supplierRaw?.name ?? null,
      notes: g.notes,
    }
  })

  // Build checklist history + stats
  const checklistHistory = (checklistResult.data ?? []) as DailyChecklist[]
  const checklistStats = computeChecklistStats(checklistHistory, 30)

  // Business documents
  const businessDocuments = (businessDocumentsResult.data ?? []) as BusinessDocument[]

  // Pest control logs
  const pestControlLogs = (pestControlLogsResult.data ?? []) as PestControlLog[]

  // Waste management
  const wasteManagement =
    (wasteManagementResult.data as WasteManagement | null) ?? null

  // Waste bin compliance % over the 30-day checklist window
  const binsTotal = checklistHistory.filter((c) => c.waste_bins_ok !== null).length
  const binsOk = checklistHistory.filter((c) => c.waste_bins_ok === true).length
  const wasteBinsCompliance = {
    totalDays: binsTotal,
    okDays: binsOk,
    pct: binsTotal > 0 ? Math.round((binsOk / binsTotal) * 100) : 0,
  }

  const shopRow = shopResult.data as typeof shopResult.data & {
    has_fridge?: boolean
    has_freezer?: boolean
  }

  // Compose compliance score from the same helpers used elsewhere
  const docSummary = computeDocumentStatus(businessDocuments, todaySAST)
  const lastPestVisit = pestControlLogs[0]?.visit_date ?? null
  const lastWasteConfirmed = wasteManagement?.last_confirmed_date ?? null

  const scoreInputs: ComplianceScoreInputs = {
    checklistCompliancePct: checklistStats.compliancePct,
    expiredBatchCount: expiredBatchesCountResult.count ?? 0,
    productCount: productsTotalCountResult.count ?? 0,
    productsWithSupplier: productsWithSupplierCountResult.count ?? 0,
    documentOverall: docSummary.overall,
    pestOverdue: isPestOverdue(lastPestVisit, todaySAST),
    wasteStale: isWasteConfirmationStale(lastWasteConfirmed, todaySAST),
  }
  const score = computeComplianceScore(scoreInputs)

  return {
    shop: {
      name: shopRow.name,
      code: shopRow.code,
      registration_number: shopRow.registration_number,
      location: shopRow.location,
    },
    inventory,
    expiryBatches,
    stockMovement: movements,
    suppliers,
    goodsReceived,
    checklistHistory,
    checklistStats,
    hasFridge: shopRow.has_fridge !== false,
    hasFreezer: shopRow.has_freezer !== false,
    businessDocuments,
    pestControlLogs,
    wasteManagement,
    wasteBinsCompliance,
    scoreInputs,
    score,
    generatedAt: new Date().toISOString(),
  }
}
