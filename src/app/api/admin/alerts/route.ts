import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import {
  createAdminAlertSchema,
} from '@/lib/validation/schemas'
import {
  createAdminAlert,
  listAllAdminAlerts,
} from '@/lib/db/admin-alerts'

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const alerts = await listAllAdminAlerts()
  return NextResponse.json({ alerts })
}

export async function POST(req: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createAdminAlertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const alert = await createAdminAlert(parsed.data)
  return NextResponse.json({ alert }, { status: 201 })
}
