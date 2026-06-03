import { NextResponse } from 'next/server'
import { getShopAuthFast } from '@/lib/auth/shop-auth'
import { checkRateLimit } from '@/lib/utils/rateLimit'
import { listDashboardReminders } from '@/lib/db/reminders'

/**
 * GET /api/compliance-reminders
 *
 * Returns the full sorted list of active (non-dismissed) reminders for the
 * authenticated owner. Used by the notification bell. Translation is done
 * client-side via the `compliance-reminders` namespace (already loaded by
 * LanguageProvider), so the response carries i18n keys + params, not strings.
 */
export async function GET(request: Request) {
  const { limited } = await checkRateLimit(request, { limit: 120, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const auth = await getShopAuthFast()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reminders = await listDashboardReminders(auth.shopId, auth.user.id)
  return NextResponse.json({ reminders })
}
