import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { adminUpdateSubscriptionSchema } from '@/lib/validation/schemas'
import { updateShopSubscription, shopExists } from '@/lib/db/admin'
import { checkRateLimit } from '@/lib/utils/rateLimit'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited } = checkRateLimit(request, { limit: 30, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = adminUpdateSubscriptionSchema.safeParse({ ...body as Record<string, unknown>, shop_id: id })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  try {
    if (!(await shopExists(id))) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }
    await updateShopSubscription(
      id,
      parsed.data.subscription_status,
      parsed.data.subscription_ends_at,
      parsed.data.trial_ends_at,
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin update subscription error:', err)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}
