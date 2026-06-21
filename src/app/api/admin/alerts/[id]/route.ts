import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { checkRateLimit } from '@/lib/utils/rateLimit'
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
  try {
    const alert = await getAdminAlert(id)
    if (!alert) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ alert })
  } catch (err) {
    console.error('Admin alert get error:', err)
    return NextResponse.json({ error: 'Failed to load alert' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
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

  const parsed = updateAdminAlertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const alert = await updateAdminAlert(id, parsed.data)
    return NextResponse.json({ alert })
  } catch (err) {
    console.error('Admin alert update error:', err)
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited } = await checkRateLimit(req, { limit: 30, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { id } = await params
  try {
    await deleteAdminAlert(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Admin alert delete error:', err)
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 })
  }
}
