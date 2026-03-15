import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildCheckoutParams, PAYFAST_HOST } from '@/lib/payfast'

/**
 * POST /api/subscribe/checkout
 *
 * Generates PayFast checkout parameters for the authenticated owner.
 * The client uses these to build a hidden form and POST to PayFast.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = user.app_metadata?.role as string | undefined
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Only shop owners can subscribe' }, { status: 403 })
  }

  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) {
    return NextResponse.json({ error: 'No shop found' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('NEXT_PUBLIC_APP_URL is not set')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const params = buildCheckoutParams({
    shopId,
    userEmail: user.email || '',
    userName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer',
    appUrl,
  })

  return NextResponse.json({
    params,
    action: `${PAYFAST_HOST}/eng/process`,
  })
}
