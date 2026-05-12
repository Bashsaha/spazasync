import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { listDashboardReminders } from '@/lib/db/reminders'

/**
 * GET /api/compliance-reminders
 *
 * Returns the full sorted list of active (non-dismissed) reminders for the
 * authenticated owner. Used by the notification bell. Translation is done
 * client-side via the `compliance-reminders` namespace (already loaded by
 * LanguageProvider), so the response carries i18n keys + params, not strings.
 */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reminders = await listDashboardReminders(auth.shopId, auth.user.id)
  return NextResponse.json({ reminders })
}
