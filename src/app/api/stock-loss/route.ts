import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getStockLoss } from '@/lib/db/stock-loss'

/** Convert a YYYY-MM-DD SAST day into an ISO UTC bound (start or end of day). */
function sastDayToUtc(ymd: string, end: boolean): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) throw new Error('bad date')
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  const d = parseInt(m[3], 10)
  // SAST is UTC+2 (no DST). SAST 00:00 = UTC -2h that day, SAST 23:59:59.999 = UTC 21:59:59.999 same day.
  const utc = end
    ? Date.UTC(y, mo - 1, d, 21, 59, 59, 999)
    : Date.UTC(y, mo - 1, d, -2, 0, 0, 0)
  return new Date(utc).toISOString()
}

/**
 * GET /api/stock-loss?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Owner-only. Returns rows + totals for stock removed without being sold,
 * in the date range (inclusive, SAST day bounds).
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
    const report = await getStockLoss(
      auth.supabase,
      auth.shopId,
      sastDayToUtc(from, false),
      sastDayToUtc(to, true),
    )
    return NextResponse.json({ from, to, ...report })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load stock loss'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
