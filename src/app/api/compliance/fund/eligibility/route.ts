import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateFundEligibilitySchema } from '@/lib/validation/schemas'

/**
 * PATCH /api/compliance/fund/eligibility
 *
 * Persists the three Fund Readiness eligibility toggles. Owner-only.
 *
 * - fund_township_rural    → shops (nullable: NULL = unanswered)
 * - fund_owner_managed     → shops (nullable: NULL = unanswered)
 * - has_disability         → owner_profiles
 *
 * Splits writes across the two tables. owner_profiles uses the admin client
 * (same pattern as Phase 37b's compliance-onboarding writes).
 */
export async function PATCH(req: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Owners only' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateFundEligibilitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { fund_township_rural, fund_owner_managed, has_disability } = parsed.data

  const shopUpdate: Record<string, boolean | null> = {}
  if (fund_township_rural !== undefined) shopUpdate.fund_township_rural = fund_township_rural
  if (fund_owner_managed !== undefined) shopUpdate.fund_owner_managed = fund_owner_managed

  if (Object.keys(shopUpdate).length > 0) {
    const { error } = await auth.supabase
      .from('shops')
      .update(shopUpdate)
      .eq('id', auth.shopId)
    if (error) {
      console.error('fund eligibility shop update failed:', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
  }

  if (has_disability !== undefined) {
    const admin = createAdminClient()
    const { error } = await admin
      .from('owner_profiles')
      .update({ has_disability, updated_at: new Date().toISOString() })
      .eq('user_id', auth.user.id)
    if (error) {
      console.error('fund eligibility owner_profile update failed:', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
