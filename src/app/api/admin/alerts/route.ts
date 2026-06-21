import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { checkRateLimit } from '@/lib/utils/rateLimit'
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
  try {
    const alerts = await listAllAdminAlerts()
    return NextResponse.json({ alerts })
  } catch (err) {
    console.error('Admin alerts list error:', err)
    return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited } = await checkRateLimit(req, { limit: 30, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

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

  try {
    const alert = await createAdminAlert(parsed.data)
    return NextResponse.json({ alert }, { status: 201 })
  } catch (err) {
    console.error('Admin alert create error:', err)
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 })
  }
}
