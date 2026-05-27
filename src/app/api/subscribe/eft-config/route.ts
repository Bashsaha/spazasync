import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/subscribe/eft-config
 *
 * Returns the EFT bank details (from env vars) plus the caller's shop code
 * — used as the payment reference. Reference MUST be the shop code so admin
 * can match incoming deposits to shops.
 *
 * Owner-only. Subscription-exempt (an expired owner needs this to pay).
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only shop owners can subscribe' }, { status: 403 })
  }

  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) {
    return NextResponse.json({ error: 'No shop found' }, { status: 400 })
  }

  const { data: shop, error } = await supabase
    .from('shops')
    .select('code')
    .eq('id', shopId)
    .single()

  if (error || !shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  }

  const price = process.env.SUBSCRIPTION_PRICE_ZAR || '349.99'

  return NextResponse.json({
    bank_name: process.env.EFT_BANK_NAME || 'TBD — bank not configured',
    account_holder: process.env.EFT_ACCOUNT_HOLDER || 'TBD — account holder not configured',
    account_number: process.env.EFT_ACCOUNT_NUMBER || 'TBD',
    branch_code: process.env.EFT_BRANCH_CODE || 'TBD',
    account_type: process.env.EFT_ACCOUNT_TYPE || 'Cheque',
    amount: parseFloat(price).toFixed(2),
    reference: shop.code,
    configured: Boolean(
      process.env.EFT_BANK_NAME &&
        process.env.EFT_ACCOUNT_HOLDER &&
        process.env.EFT_ACCOUNT_NUMBER &&
        process.env.EFT_BRANCH_CODE,
    ),
  })
}
