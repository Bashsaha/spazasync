import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getTellerAccessStatus } from '@/lib/db/access-requests'

/**
 * GET /api/access-requests/me
 *   Teller-only. Returns the teller's current inventory access state plus
 *   the most-recent request (any status) so the UI can show pending /
 *   denied / expired states without a second call.
 */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'teller') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const status = await getTellerAccessStatus(auth.supabase, auth.user.id)
    return NextResponse.json(status)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
