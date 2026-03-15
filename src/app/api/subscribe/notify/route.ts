import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateITN } from '@/lib/payfast'

/**
 * POST /api/subscribe/notify
 *
 * PayFast ITN (Instant Transaction Notification) webhook.
 * Called by PayFast servers — no user auth required.
 * Validates the request, then updates the shop's subscription status.
 */
export async function POST(request: NextRequest) {
  const sourceIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  // Parse the form-urlencoded body
  let body: Record<string, string>
  try {
    const text = await request.text()
    const params = new URLSearchParams(text)
    body = Object.fromEntries(params.entries())
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Validate the ITN (signature + IP + server confirmation)
  const validation = await validateITN(body, sourceIp)
  if (!validation.valid) {
    console.error('PayFast ITN validation failed:', validation.reason)
    return NextResponse.json({ error: 'Invalid ITN' }, { status: 403 })
  }

  const shopId = body.m_payment_id
  const paymentStatus = body.payment_status
  const token = body.token // PayFast recurring billing token

  if (!shopId || !paymentStatus) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (paymentStatus === 'COMPLETE') {
    // Payment successful — activate subscription
    const subscriptionEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const { error: updateError } = await admin
      .from('shops')
      .update({
        subscription_status: 'active',
        subscription_ends_at: subscriptionEndsAt,
        trial_ends_at: null,
        ...(token ? { payfast_token: token } : {}),
      })
      .eq('id', shopId)

    if (updateError) {
      console.error('Failed to update shop subscription:', updateError)
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
    }

    // Update app_metadata for all users in this shop
    await updateAllShopUsersMetadata(admin, shopId, 'active', subscriptionEndsAt)
  } else if (paymentStatus === 'CANCELLED') {
    // Subscription cancelled — keep access until subscription_ends_at
    const { error: updateError } = await admin
      .from('shops')
      .update({ subscription_status: 'cancelled' })
      .eq('id', shopId)

    if (updateError) {
      console.error('Failed to update shop subscription:', updateError)
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
    }

    // Get the current subscription_ends_at to pass to metadata
    const { data: shop } = await admin
      .from('shops')
      .select('subscription_ends_at')
      .eq('id', shopId)
      .single()

    await updateAllShopUsersMetadata(
      admin,
      shopId,
      'cancelled',
      shop?.subscription_ends_at || new Date().toISOString(),
    )
  }
  // For FAILED or other statuses, do nothing — let the subscription naturally expire

  return new NextResponse('OK', { status: 200 })
}

/**
 * Update app_metadata.sub_status and sub_until for all auth users in a shop.
 */
async function updateAllShopUsersMetadata(
  admin: ReturnType<typeof createAdminClient>,
  shopId: string,
  subStatus: string,
  subUntil: string,
) {
  const { data: shopUsers } = await admin
    .from('shop_users')
    .select('user_id')
    .eq('shop_id', shopId)

  if (!shopUsers) return

  for (const su of shopUsers) {
    try {
      await admin.auth.admin.updateUserById(su.user_id, {
        app_metadata: { sub_status: subStatus, sub_until: subUntil },
      })
    } catch (err) {
      console.error(`Failed to update metadata for user ${su.user_id}:`, err)
    }
  }
}
