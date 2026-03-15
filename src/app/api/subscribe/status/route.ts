import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SubscriptionInfo } from '@/types'

/**
 * GET /api/subscribe/status
 *
 * Returns the subscription status for the authenticated user's shop.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) {
    return NextResponse.json({ error: 'No shop found' }, { status: 400 })
  }

  const { data: shop, error } = await supabase
    .from('shops')
    .select('subscription_status, trial_ends_at, subscription_ends_at')
    .eq('id', shopId)
    .single()

  if (error || !shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  }

  // Calculate days remaining
  let daysRemaining: number | null = null
  const endDate = shop.subscription_status === 'trialing'
    ? shop.trial_ends_at
    : shop.subscription_ends_at

  if (endDate) {
    const msRemaining = new Date(endDate).getTime() - Date.now()
    daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)))
  }

  const info: SubscriptionInfo = {
    status: shop.subscription_status,
    trialEndsAt: shop.trial_ends_at,
    subscriptionEndsAt: shop.subscription_ends_at,
    daysRemaining,
  }

  return NextResponse.json(info)
}
