import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { dismissReminderSchema } from '@/lib/validation/schemas'

/**
 * POST /api/compliance-reminders/dismiss
 *
 * Owner taps "Dismiss" on the reminder banner. UPSERTs the ledger row with
 * `dismissed_at = now()`. Idempotent — repeated calls just refresh the
 * timestamp. Use service-role to bypass any RLS edge cases (the row is
 * shop-scoped via `shop_id` from the auth context, so impersonation isn't
 * possible).
 */
export async function POST(req: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = dismissReminderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await admin.from('compliance_reminders').upsert(
    {
      shop_id: auth.shopId,
      reminder_type: parsed.data.reminder_type,
      reminder_key: parsed.data.reminder_key,
      dismissed_at: now,
      shown_at: now,
    },
    { onConflict: 'shop_id,reminder_key' },
  )

  if (error) {
    console.error('Failed to dismiss reminder:', error)
    return NextResponse.json({ error: 'Could not dismiss' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
