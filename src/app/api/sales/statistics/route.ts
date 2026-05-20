import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getSalesStatistics } from '@/lib/db/sales-statistics'

/**
 * GET /api/sales/statistics?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Owner-only (+ dual-role admin). Returns the period overview: revenue trend,
 * top/lowest sellers, most profitable products, and non-movers.
 */
export async function GET(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json(
      { error: 'from and to are required (YYYY-MM-DD)' },
      { status: 400 },
    )
  }
  if (from > to) {
    return NextResponse.json({ error: 'from must be <= to' }, { status: 400 })
  }

  try {
    const { data: shop } = await auth.supabase
      .from('shops')
      .select('profit_tracking_enabled')
      .eq('id', auth.shopId)
      .single()
    const profitOn = Boolean(shop?.profit_tracking_enabled)

    const stats = await getSalesStatistics(auth.shopId, from, to, profitOn)
    return NextResponse.json(stats)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load statistics'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
