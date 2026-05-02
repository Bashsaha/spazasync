import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/compliance-onboarding/dismiss
 *
 * Owner has tapped "Not now" on the dashboard banner. Records the dismissal
 * timestamp + bumps the count, which feeds shouldShowComplianceBanner's
 * 7/30-day snooze rules.
 */
export async function POST() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: shop } = await admin
    .from('shops')
    .select('onboarding_compliance_dismiss_count')
    .eq('id', auth.shopId)
    .single()

  const nextCount = (shop?.onboarding_compliance_dismiss_count ?? 0) + 1

  const { error } = await admin
    .from('shops')
    .update({
      onboarding_compliance_dismissed_at: new Date().toISOString(),
      onboarding_compliance_dismiss_count: nextCount,
    })
    .eq('id', auth.shopId)

  if (error) {
    console.error('Failed to dismiss compliance banner:', error)
    return NextResponse.json({ error: 'Could not dismiss' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
