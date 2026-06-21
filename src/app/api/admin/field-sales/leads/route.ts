import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { checkRateLimit } from '@/lib/utils/rateLimit'
import { createLeadSchema, leadListQuerySchema } from '@/lib/validation/schemas'
import { createLead, listLeads } from '@/lib/db/field-sales'

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = leadListQuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  try {
    const { leads, total } = await listLeads(parsed.data)
    return NextResponse.json({ leads, total, page: parsed.data.page, limit: parsed.data.limit })
  } catch (err) {
    console.error('Field-sales leads list error:', err)
    return NextResponse.json({ error: 'Failed to load leads' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited } = await checkRateLimit(request, { limit: 30, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createLeadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const lead = await createLead(parsed.data, user.id)
    return NextResponse.json({ lead }, { status: 201 })
  } catch (err) {
    console.error('Field-sales create lead error:', err)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
