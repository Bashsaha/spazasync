import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { listSalesForDate, computeDailyTotals } from '@/lib/db/sales-history'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** GET /api/sales/by-date?date=YYYY-MM-DD — sales + totals for a SAST day */
export async function GET(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId, supabase } = auth

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? ''
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }

  try {
    const { data: shop } = await supabase
      .from('shops')
      .select('profit_tracking_enabled')
      .eq('id', shopId)
      .single()
    const profitTrackingEnabled = Boolean(shop?.profit_tracking_enabled)

    const sales = await listSalesForDate(supabase, shopId, date)
    const totals = computeDailyTotals(sales, profitTrackingEnabled)

    return NextResponse.json({ sales, totals, profit_tracking_enabled: profitTrackingEnabled })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
