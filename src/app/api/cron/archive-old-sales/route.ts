import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { bearerMatches } from '@/lib/utils/timing-safe'

/**
 * GET /api/cron/archive-old-sales
 *
 * Phase 45f — moves sales (+ their sale_items) older than the retention window
 * into the partitioned cold-archive tables, keeping the hot `sales`/`sale_items`
 * tables (and their indexes) small as years of history accumulate. Runs monthly.
 *
 * Retention = 18 months: FAR beyond every report range the UI offers (the stats
 * page caps at 365 days; dashboard is today/30/90), so NO report ever needs the
 * archive. Archived rows are cold storage, queryable for audit/SARS via the
 * sales_archive tables. (Note: a sale's batch-consumption FEFO trail is dropped
 * on archive via ON DELETE CASCADE — the financial record (sales + items) is
 * preserved; the fine-grained 18-month-old batch trail is not.)
 *
 * Dormant until data is old enough — for a young shop this is a 0-row no-op.
 */
const RETENTION_MONTHS = 18
const BATCH = 1000
const MAX_BATCHES_PER_RUN = 50 // bounded so one invocation never runs away

export async function GET(request: Request) {
  if (!bearerMatches(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS)
  const cutoffIso = cutoff.toISOString()

  const admin = createAdminClient()
  let total = 0
  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    const { data, error } = await admin.rpc('archive_old_sales', {
      p_before: cutoffIso,
      p_batch: BATCH,
    })
    if (error) {
      console.error('archive_old_sales failed:', error)
      return NextResponse.json({ error: error.message, archived: total }, { status: 500 })
    }
    const n = (data as number | null) ?? 0
    total += n
    if (n < BATCH) break // last (partial) batch — nothing more to do
  }

  return NextResponse.json({ archived: total, cutoff: cutoffIso })
}
