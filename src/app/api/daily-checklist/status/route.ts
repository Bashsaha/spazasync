import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getTodayChecklist, todaySAST } from '@/lib/db/daily-checklist'

/** GET /api/daily-checklist/status
 *  Lightweight check — returns { completed: boolean } so the FAB can
 *  hide itself after a checklist save without re-fetching the full page data.
 */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const checklist = await getTodayChecklist(auth.shopId, todaySAST())
  return NextResponse.json(
    { completed: checklist !== null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
