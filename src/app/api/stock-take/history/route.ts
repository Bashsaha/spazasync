import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getStockTakeHistory } from '@/lib/db/stock-take-history'
import { STABLE_READ_CACHE } from '@/lib/utils/api'

/**
 * GET /api/stock-take/history
 * Owner/admin only — the "who counted what" session list. Cache-first on the
 * client (Phase 44b).
 */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sessions = await getStockTakeHistory(auth.shopId)
  return NextResponse.json({ sessions }, { headers: STABLE_READ_CACHE })
}
