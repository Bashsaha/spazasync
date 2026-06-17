import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { updateLeadSchema } from '@/lib/validation/schemas'
import { deleteLead, getLeadDetail, updateLead } from '@/lib/db/field-sales'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const lead = await getLeadDetail(id)
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ lead })
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateLeadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const lead = await updateLead(id, parsed.data)
    return NextResponse.json({ lead })
  } catch (err) {
    console.error('Field-sales update lead error:', err)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    await deleteLead(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Field-sales delete lead error:', err)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
