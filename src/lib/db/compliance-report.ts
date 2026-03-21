import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'
import type { StockMovementEntry } from '@/types'

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
  const [shopResult, productsResult, batchesResult, adjustmentsResult, salesResult] =
    await Promise.all([
      // Shop info
      supabase
        .from('shops')
        .select('name, code, registration_number, location')
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

  return {
    shop: shopResult.data,
    inventory,
    expiryBatches,
    stockMovement: movements,
    generatedAt: new Date().toISOString(),
  }
}
