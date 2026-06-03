import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/cron/expire-subscriptions
 *
 * Vercel Cron fires this daily. Phase 45e: flips every due shop to 'expired' in
 * ONE bulk SQL statement (was a per-shop serial loop that would time out at
 * scale), then syncs JWT app_metadata for that day's affected users with bounded
 * concurrency.
 *
 * Correctness note: trial / cancelled expiry already blocks the owner gate via
 * the JWT's past `sub_until` (lib/subscription/expiry.ts), and the teller lockout
 * reads the LIVE shop row — so the JWT sync below is housekeeping for the
 * access_granted-override subset, not the load-bearing gate. That's why it can be
 * best-effort: each run only flips not-yet-expired shops (the day's delta), so it
 * never reprocesses, and a partial sync never leaves an expired shop reachable.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // 1. Bulk-flip every due shop (trials + cancelled + lapsed manual overrides).
  const { data: flipped, error } = await admin.rpc('expire_due_shops')
  if (error) {
    console.error('expire_due_shops failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const shopIds = ((flipped ?? []) as { shop_id: string }[]).map((r) => r.shop_id)
  if (shopIds.length === 0) {
    return NextResponse.json({ expired: 0, synced: 0, users: 0 })
  }

  // 2. Sync JWT metadata for those shops' users (bounded concurrency).
  const { data: rows } = await admin
    .from('shop_users')
    .select('user_id')
    .in('shop_id', shopIds)
  const userIds = Array.from(
    new Set(((rows ?? []) as { user_id: string }[]).map((u) => u.user_id)),
  )

  let synced = 0
  const CONCURRENCY = 10
  for (let i = 0; i < userIds.length; i += CONCURRENCY) {
    const chunk = userIds.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      chunk.map((uid) =>
        admin.auth.admin.updateUserById(uid, {
          app_metadata: { sub_status: 'expired', sub_until: now, access_granted: false },
        }),
      ),
    )
    synced += results.filter((r) => r.status === 'fulfilled').length
  }

  return NextResponse.json({ expired: shopIds.length, synced, users: userIds.length })
}
