import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateShopUsersSubscription } from '@/lib/auth/teller'

/**
 * GET /api/cron/expire-subscriptions
 *
 * Vercel Cron fires this at 00:00 UTC (02:00 SAST) daily.
 * Finds shops with expired trials or cancelled subscriptions past their end date,
 * sets them to 'expired', and updates all users' JWT metadata.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // 1. Expired trials: trialing + trial_ends_at < now
  const { data: expiredTrials, error: trialErr } = await admin
    .from('shops')
    .select('id')
    .eq('subscription_status', 'trialing')
    .lt('trial_ends_at', now)

  if (trialErr) {
    console.error('Failed to fetch expired trials:', trialErr)
  }

  // 2. Expired cancelled: cancelled + subscription_ends_at < now
  const { data: expiredCancelled, error: cancelErr } = await admin
    .from('shops')
    .select('id')
    .eq('subscription_status', 'cancelled')
    .lt('subscription_ends_at', now)

  if (cancelErr) {
    console.error('Failed to fetch expired cancelled:', cancelErr)
  }

  // 3. Expired manual overrides: manual_override + subscription_ends_at < now
  const { data: expiredManual, error: manualErr } = await admin
    .from('shops')
    .select('id')
    .eq('subscription_status', 'manual_override')
    .not('subscription_ends_at', 'is', null)
    .lt('subscription_ends_at', now)

  if (manualErr) {
    console.error('Failed to fetch expired manual overrides:', manualErr)
  }

  const shopsToExpire = [
    ...(expiredTrials || []),
    ...(expiredCancelled || []),
    ...(expiredManual || []),
  ]

  let expiredCount = 0

  for (const shop of shopsToExpire) {
    try {
      // Update shop status to expired and revoke access
      await admin
        .from('shops')
        .update({ subscription_status: 'expired', access_granted: false })
        .eq('id', shop.id)

      // Update all users' JWT metadata (access_granted = false)
      await updateShopUsersSubscription(shop.id, 'expired', now, false)

      expiredCount++
    } catch (err) {
      console.error(`Failed to expire shop ${shop.id}:`, err)
    }
  }

  return NextResponse.json({
    expired: expiredCount,
    checked: shopsToExpire.length,
  })
}
