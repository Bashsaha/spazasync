import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import { tellerTrainingSchema } from '@/lib/validation/schemas'

/**
 * PATCH /api/tellers/[id]/training
 *
 * Toggle a teller's food-safety training status (Phase 37c, Step 6).
 * - { trained: true }  → sets food_safety_trained_at to now (or trained_at if supplied)
 * - { trained: false } → clears food_safety_trained_at
 *
 * Owner-only. RLS additionally scopes the update to the owner's shop, so the
 * id-in-URL trick can't reach another shop's tellers.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Owners only' }, { status: 403 })
  }

  const parsed = await parseBody(request, tellerTrainingSchema)
  if (parsed instanceof NextResponse) return parsed

  const { id } = await params

  const trainedAt = parsed.trained
    ? parsed.trained_at ?? new Date().toISOString()
    : null

  const { data, error } = await auth.supabase
    .from('tellers')
    .update({ food_safety_trained_at: trainedAt })
    .eq('id', id)
    .eq('shop_id', auth.shopId)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Teller not found' }, { status: 404 })
  }
  return NextResponse.json(data)
}
