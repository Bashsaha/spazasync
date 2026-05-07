import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import {
  updateAdminAlertSchema,
} from '@/lib/validation/schemas'
import {
  deleteAdminAlert,
  getAdminAlert,
  updateAdminAlert,
} from '@/lib/db/admin-alerts'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const alert = await getAdminAlert(id)
  if (!alert) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ alert })
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

  const parsed = updateAdminAlertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const alert = await updateAdminAlert(id, parsed.data)
  return NextResponse.json({ alert })
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await deleteAdminAlert(id)
  return NextResponse.json({ ok: true })
}
