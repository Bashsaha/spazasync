import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { adminManualPaymentSchema } from '@/lib/validation/schemas'
import { recordManualPayment, shopExists } from '@/lib/db/admin'
import { checkRateLimit } from '@/lib/utils/rateLimit'

export async function POST(
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

  const parsed = adminManualPaymentSchema.safeParse({ ...body as Record<string, unknown>, shop_id: id })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  try {
    if (!(await shopExists(id))) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }
    const payment = await recordManualPayment(parsed.data, admin.id)
    return NextResponse.json(payment, { status: 201 })
  } catch (err) {
    console.error('Admin record payment error:', err)
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
  }
}
