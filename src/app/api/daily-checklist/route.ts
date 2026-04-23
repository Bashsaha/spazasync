import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import { upsertChecklistSchema } from '@/lib/validation/schemas'
import {
  getTodayChecklist,
  getPreviousTemps,
  upsertChecklist,
  todaySAST,
} from '@/lib/db/daily-checklist'
import { listExpiringProducts } from '@/lib/db/batches'

/**
 * GET /api/daily-checklist
 * Returns today's saved checklist (if any), shop equipment flags,
 * and the list of products expiring today / already expired — used as an
 * inline nudge on the checklist page.
 */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = todaySAST()

  const [shopResult, checklist, expiring, previousTemps] = await Promise.all([
    auth.supabase
      .from('shops')
      .select('has_fridge, has_freezer')
      .eq('id', auth.shopId)
      .single(),
    getTodayChecklist(auth.shopId, date),
    listExpiringProducts(auth.shopId),
    getPreviousTemps(auth.shopId, date),
  ])

  const hasFridge = shopResult.data?.has_fridge ?? true
  const hasFreezer = shopResult.data?.has_freezer ?? true

  // Filter to only products that are already expired or expire today
  const expiringToday = (expiring ?? []).filter((p) => {
    if (p.expired_qty > 0) return true
    return p.earliest_expiry === date
  })

  return NextResponse.json({
    date,
    checklist,
    hasFridge,
    hasFreezer,
    expiringToday,
    previousTemps,
  })
}

/** POST /api/daily-checklist — upsert today's row. */
export async function POST(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(request, upsertChecklistSchema)
  if (parsed instanceof NextResponse) return parsed

  try {
    const saved = await upsertChecklist(auth.shopId, auth.user.id, todaySAST(), parsed)
    return NextResponse.json(saved)
  } catch (err) {
    console.error('Failed to save checklist:', err)
    return NextResponse.json({ error: 'Could not save checklist' }, { status: 500 })
  }
}
