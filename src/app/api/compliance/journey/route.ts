import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getJourneyData } from '@/lib/db/journey'

/**
 * GET /api/compliance/journey
 *
 * Returns the composite payload powering the /compliance/journey page:
 * owner profile, shop fields, municipality + offices + requirements,
 * business_documents, tellers, product names, monthly revenue, the
 * computed step list with statuses, and the inspection-readiness panel
 * data for Step 2.
 *
 * Owner-only — tellers are blocked at the proxy layer but we double-check
 * the role here so a future routing change can't accidentally expose
 * owner-personal data.
 */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Owners only' }, { status: 403 })
  }

  const data = await getJourneyData(auth.shopId, auth.user.id)
  if (!data) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  return NextResponse.json(data)
}
