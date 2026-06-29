import { NextResponse } from 'next/server'
import { getShopAuthFast } from '@/lib/auth/shop-auth'
import { getTodayChecklist, hasAnyChecklist, todaySAST } from '@/lib/db/daily-checklist'

/** GET /api/daily-checklist/status
 *  Lightweight check — returns { completed, everCompleted } so the FAB can
 *  hide itself after a checklist save (completed) AND decide whether to show
 *  the one-time intro explainer (everCompleted === false → first checklist).
 */
export async function GET() {
  // Read-only status check → local JWT verify (no auth-server round-trip).
  const auth = await getShopAuthFast()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [checklist, everCompleted] = await Promise.all([
    getTodayChecklist(auth.shopId, todaySAST()),
    hasAnyChecklist(auth.shopId),
  ])
  return NextResponse.json(
    { completed: checklist !== null, everCompleted },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
