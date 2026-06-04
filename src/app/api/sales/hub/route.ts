import { NextResponse } from 'next/server'
import { getShopAuthFast } from '@/lib/auth/shop-auth'
import { checkRateLimit } from '@/lib/utils/rateLimit'
import { STABLE_READ_CACHE } from '@/lib/utils/api'
import {
  getDailySalesForShop,
  getWeeklySalesForShop,
  getTopProductsThisWeek,
  getRecentSalesForShop,
} from '@/lib/db/reports'

/**
 * GET /api/sales/hub — the whole /sales hub in one payload (today summary,
 * weekly chart series, top products, latest sales, profit flag). Lets the hub
 * render DATA-FREE + client cache-first (instant repeat-open; never
 * server-renders into a sleeping radio on resume). Owner/admin only — tellers
 * are locked to /sale by proxy.ts and 403'd here. RLS scopes every reader.
 */
export async function GET(request: Request) {
  const { limited } = await checkRateLimit(request, { limit: 120, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const auth = await getShopAuthFast()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role === 'teller') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { shopId, supabase } = auth

  // Each reader degrades to a safe empty value on its own throw so one slow
  // query can't 500 the whole hub.
  const safe = <T,>(p: PromiseLike<T>, fallback: T): Promise<T> =>
    Promise.resolve(p).then((v) => v, () => fallback)

  const [shopRes, summary, weekly, topProducts, recentSales] = await Promise.all([
    safe(
      supabase
        .from('shops')
        .select('profit_tracking_enabled')
        .eq('id', shopId)
        .single()
        .then((r) => r.data),
      null as null | { profit_tracking_enabled: boolean | null },
    ),
    safe(getDailySalesForShop(shopId, new Date(), supabase), {
      totalRevenue: 0,
      salesCount: 0,
      totalProfit: 0,
      tellerCount: 0,
    } as Awaited<ReturnType<typeof getDailySalesForShop>>),
    safe(getWeeklySalesForShop(shopId), [] as Awaited<ReturnType<typeof getWeeklySalesForShop>>),
    safe(getTopProductsThisWeek(shopId, 5), [] as Awaited<ReturnType<typeof getTopProductsThisWeek>>),
    safe(getRecentSalesForShop(shopId, 10, supabase), [] as Awaited<ReturnType<typeof getRecentSalesForShop>>),
  ])

  return NextResponse.json(
    {
      profitTrackingEnabled: Boolean(shopRes?.profit_tracking_enabled),
      summary,
      weekly,
      topProducts,
      recentSales,
    },
    { headers: STABLE_READ_CACHE },
  )
}
