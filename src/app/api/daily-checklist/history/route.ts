import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import {
  listChecklistHistory,
  computeChecklistStats,
  dateStrSAST,
} from '@/lib/db/daily-checklist'
import type { DailyChecklist } from '@/types'

/**
 * GET /api/daily-checklist/history?days=30
 * Returns the last N days of checklist rows (with gap-filled missed days marked null)
 * plus aggregate stats for the same window.
 */
export async function GET(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const daysParam = Number(url.searchParams.get('days') ?? '30')
  const days = Math.max(7, Math.min(90, Number.isFinite(daysParam) ? daysParam : 30))

  try {
    const rows = await listChecklistHistory(auth.shopId, days)
    const stats = computeChecklistStats(rows, days)

    // Gap-fill: produce one entry per day in the window so the UI can render
    // a calendar-style grid without computing missing dates itself.
    const byDate = new Map(rows.map((r) => [r.date, r]))
    const entries: Array<{ date: string; entry: DailyChecklist | null }> = []
    for (let i = 0; i < days; i += 1) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ds = dateStrSAST(d)
      entries.push({ date: ds, entry: byDate.get(ds) ?? null })
    }

    return NextResponse.json({ entries, stats, days })
  } catch (err) {
    console.error('Failed to load checklist history:', err)
    return NextResponse.json({ error: 'Could not load history' }, { status: 500 })
  }
}
