'use client'

/**
 * Phase 45f — Admin DB-size monitoring widget.
 *
 * Shows total database size + the largest tables, so growth is visible long
 * before any Supabase storage ceiling. Tone references the free-tier 500MB cap
 * (green < 250MB, amber < 450MB, red ≥ 450MB) — adjust the thresholds if you
 * move to a paid tier with more headroom. This is the signal that tells you WHEN
 * the sales cold-archive (cron/archive-old-sales) starts to matter.
 */

import { useEffect, useState } from 'react'
import { Database, HardDrive, AlertTriangle } from 'lucide-react'
import type { DbSizeStats } from '@/app/api/admin/db-stats/route'

const MB = 1024 * 1024
const AMBER_MB = 250
const RED_MB = 450

function mb(bytes: number): string {
  return `${(bytes / MB).toFixed(1)} MB`
}

export function DbSizeWidget() {
  const [data, setData] = useState<DbSizeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/db-stats')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: DbSizeStats) => setData(d))
      .catch(() => setError('Failed to load database stats'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-2xl p-5 bg-white">
        <p className="text-sm text-gray-500">Loading database stats…</p>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="border border-gray-200 rounded-2xl p-5 bg-white">
        <p className="text-sm text-gray-500">{error ?? 'No data'}</p>
      </div>
    )
  }

  const totalMb = data.db_bytes / MB
  const tone =
    totalMb >= RED_MB
      ? { wrap: 'bg-red-50 border-red-200', text: 'text-red-700', Icon: AlertTriangle }
      : totalMb >= AMBER_MB
        ? { wrap: 'bg-amber-50 border-amber-200', text: 'text-amber-700', Icon: HardDrive }
        : { wrap: 'bg-green-50 border-green-200', text: 'text-green-700', Icon: Database }
  const { Icon } = tone

  return (
    <div className={`border rounded-2xl p-5 ${tone.wrap}`}>
      <div className="flex items-center gap-3 mb-1">
        <Icon className={`w-5 h-5 ${tone.text}`} aria-hidden="true" />
        <h2 className="font-semibold text-gray-900">Database size</h2>
      </div>
      <p className={`text-3xl font-bold ${tone.text}`}>{mb(data.db_bytes)}</p>
      <p className="text-xs text-gray-500 mt-1">
        Free-tier ceiling is ~500 MB. The sales cold-archive cron keeps the hot tables
        small once history builds up.
      </p>

      {data.tables.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">
            Largest tables
          </p>
          <ul className="divide-y divide-gray-100 bg-white/60 rounded-xl overflow-hidden">
            {data.tables.slice(0, 8).map((t) => (
              <li key={t.name} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-medium text-gray-800 truncate">{t.name}</span>
                <span className="text-gray-500 tabular-nums shrink-0 ml-3">
                  {mb(t.total_bytes)} · ~{t.rows_estimate.toLocaleString()} rows
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
