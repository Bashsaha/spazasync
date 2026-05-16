import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { listProductsWithStock, adjustStock } from '@/lib/db/stock'
import { getExpiryStats, listExpiringProducts } from '@/lib/db/batches'
import { stockAdjustSchema } from '@/lib/validation/schemas'

/** GET /api/stock?search=&expiring=1 — list products with stock levels (or expiring products) */
export async function GET(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId } = auth

  const { searchParams } = new URL(request.url)

  // If ?expiring=1, return expiring products list
  if (searchParams.get('expiring') === '1') {
    try {
      const expiringProducts = await listExpiringProducts(shopId)
      return NextResponse.json({ expiring_products: expiringProducts })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  const search = searchParams.get('search') ?? undefined

  try {
    const result = await listProductsWithStock(search)
    // Also fetch expiry count for the summary strip
    const stats = await getExpiryStats(shopId)

    // Fetch profit tracking flag + count products missing cost price
    const { data: shop } = await auth.supabase
      .from('shops')
      .select('profit_tracking_enabled')
      .eq('id', shopId)
      .single()

    let productsMissingCost = 0
    if (shop?.profit_tracking_enabled) {
      const { count } = await auth.supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .is('cost_price', null)
      productsMissingCost = count ?? 0
    }

    const [missingSupplierRes, suppliersRes] = await Promise.all([
      auth.supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .is('supplier_id', null),
      auth.supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId),
    ])

    return NextResponse.json({
      ...result,
      expiring_count: stats.expiringProducts + stats.expiredProducts,
      profit_tracking_enabled: Boolean(shop?.profit_tracking_enabled),
      products_missing_cost: productsMissingCost,
      products_missing_supplier: missingSupplierRes.count ?? 0,
      suppliers_count: suppliersRes.count ?? 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST /api/stock — adjust stock qty for a product */
export async function POST(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = stockAdjustSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const updated = await adjustStock({
      product_id: parsed.data.product_id,
      qty_delta: parsed.data.qty_delta,
      reason: parsed.data.reason,
    })
    return NextResponse.json(updated, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
