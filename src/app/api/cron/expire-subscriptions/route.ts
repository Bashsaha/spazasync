import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { bearerMatches } from '@/lib/utils/timing-safe'
import { updateShopUsersSubscription } from '@/lib/auth/teller'
import { subscriptionEndDate } from '@/lib/subscription/expiry'

/**
 * GET /api/cron/expire-subscriptions
 *
 * Vercel Cron fires this daily. Phase 45e: flips every due shop in ONE bulk SQL
 * statement (was a per-shop serial loop that would time out at scale), then syncs
 * JWT app_metadata for that day's affected users with bounded concurrency.
 *
 * Phase 54 (grace window): `expire_due_shops()` is now TWO-STAGE — a lapsed shop
 * first moves to 'processing_cancellation' (4-day grace, access KEPT), then to
 * 'expired' once the grace deadline passes. The returned set therefore mixes
 * graced shops (must stay reachable) with fully-expired shops, so we can NO LONGER
 * hardcode an expired payload for everyone. Instead we re-read each flipped shop's
 * live row and sync its REAL state into JWT metadata (graced → future sub_until,
 * expired → past sub_until + access revoked) via the shared helper, so the owner
 * gate (proxy.ts) and the teller lockout (live row) can't drift.
 *
 * Best-effort: each run only flips shops that just crossed a boundary (the day's
 * delta), so it never reprocesses, and a partial sync never leaves an expired shop
 * reachable (the live row already says expired; the teller lockout reads it).
 */
export async function GET(request: Request) {
  if (!bearerMatches(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 1. Bulk-flip every shop that just crossed a boundary: active/trialing → grace
  //    (processing_cancellation), and grace → expired.
  const { data: flipped, error } = await admin.rpc('expire_due_shops')
  if (error) {
    console.error('expire_due_shops failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const shopIds = ((flipped ?? []) as { shop_id: string }[]).map((r) => r.shop_id)
  if (shopIds.length === 0) {
    return NextResponse.json({ flipped: 0, synced: 0 })
  }

  // 2. Re-read the flipped shops' live rows and sync each one's REAL state into
  //    JWT metadata (graced shops stay reachable; expired shops lose access).
  const { data: shopRows } = await admin
    .from('shops')
    .select('id, subscription_status, trial_ends_at, subscription_ends_at, access_granted')
    .in('id', shopIds)

  const rows = (shopRows ?? []) as {
    id: string
    subscription_status: string
    trial_ends_at: string | null
    subscription_ends_at: string | null
    access_granted: boolean
  }[]

  let synced = 0
  const CONCURRENCY = 10
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      chunk.map((s) => {
        const subUntil =
          subscriptionEndDate(s.subscription_status, s.trial_ends_at, s.subscription_ends_at) ?? ''
        return updateShopUsersSubscription(
          s.id,
          s.subscription_status,
          subUntil,
          s.access_granted,
        )
      }),
    )
    synced += results.filter((r) => r.status === 'fulfilled').length
  }

  return NextResponse.json({ flipped: shopIds.length, synced })
}
