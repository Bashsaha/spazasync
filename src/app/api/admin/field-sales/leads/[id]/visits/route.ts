import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { checkRateLimit } from '@/lib/utils/rateLimit'
import { createVisitSchema } from '@/lib/validation/schemas'
import { createVisit } from '@/lib/db/field-sales'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited } = await checkRateLimit(req, { limit: 30, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createVisitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const visit = await createVisit(id, parsed.data, user.id)
    return NextResponse.json({ visit }, { status: 201 })
  } catch (err) {
    console.error('Field-sales log visit error:', err)
    return NextResponse.json({ error: 'Failed to log visit' }, { status: 500 })
  }
}
