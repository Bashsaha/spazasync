import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { eftApplyOneSchema } from '@/lib/validation/schemas'
import { checkRateLimit } from '@/lib/utils/rateLimit'
import { applyOneDeposit } from '@/lib/db/eft-reconcile'

/**
 * POST /api/admin/eft-reconcile/apply-one
 *
 * Manually apply a single reviewed/unmatched deposit to a chosen shop.
 * Uses the same idempotent, renewal-aware engine as the batch path.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited } = await checkRateLimit(request, { limit: 60, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = eftApplyOneSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  try {
    const result = await applyOneDeposit(parsed.data, admin.id)
    if (result.status === 'shop_not_found') {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }
    if (result.status === 'duplicate') {
      return NextResponse.json({ error: 'This deposit was already applied' }, { status: 409 })
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('EFT apply-one error:', err)
    return NextResponse.json({ error: 'Failed to apply deposit' }, { status: 500 })
  }
}
