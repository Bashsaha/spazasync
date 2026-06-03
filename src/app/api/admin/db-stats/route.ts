/**
 * Phase 45f — DB size monitoring (admin-only).
 *
 * GET → total database size + the largest public tables (size + estimated rows).
 * Lets the admin SEE transactional-data growth coming and know WHEN the
 * sales cold-archive (cron/archive-old-sales) starts to matter, well before any
 * Supabase storage ceiling bites.
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export interface DbTableSize {
  name: string
  total_bytes: number
  rows_estimate: number
}
export interface DbSizeStats {
  db_bytes: number
  tables: DbTableSize[]
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('db_size_stats')
  if (error) {
    console.error('db-stats GET failed:', error)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
  }

  return NextResponse.json((data ?? { db_bytes: 0, tables: [] }) as DbSizeStats)
}
