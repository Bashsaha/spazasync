import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/cron/prune-reminders
 *
 * Vercel Cron fires this daily. Trims the `compliance_reminders` ledger so
 * the table doesn't grow without bound — each shop accrues weekly /
 * bi-weekly / annual bucket rows that are never re-read once the cycle
 * window has rolled past.
 *
 * Retention policy:
 *   - Rows older than 180 days are deleted regardless of dismissal state.
 *   - Re-firing a future cycle uses a new `reminder_key` bucket, so a
 *     prune does NOT silently re-show old reminders (the new bucket is a
 *     new row).
 *
 * Without this, a successful 20-shop user base risks breaching the free
 * tier's 500 MB DB limit inside year one.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await admin
    .from('compliance_reminders')
    .delete()
    .lt('shown_at', cutoff)
    .select('id')

  if (error) {
    console.error('Failed to prune compliance_reminders:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    deleted: data?.length ?? 0,
    cutoff,
  })
}
