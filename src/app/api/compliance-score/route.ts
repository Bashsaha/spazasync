import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getComplianceScore } from '@/lib/db/compliance-score'
import { STABLE_READ_CACHE } from '@/lib/utils/api'

/**
 * GET /api/compliance-score
 *
 * Returns the authenticated shop's compliance score + category breakdown.
 */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { inputs, result } = await getComplianceScore(auth.supabase, auth.shopId)
    return NextResponse.json({ inputs, result }, { headers: STABLE_READ_CACHE })
  } catch (err) {
    console.error('Compliance score calc failed:', err)
    return NextResponse.json({ error: 'Failed to compute score' }, { status: 500 })
  }
}
