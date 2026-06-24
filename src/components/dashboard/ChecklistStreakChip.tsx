'use client'

import Link from 'next/link'
import { useTranslation } from '@/components/LanguageProvider'

/**
 * Daily-checklist habit chip (the "🔥 N-day streak" loss-aversion nudge).
 * Presentational — takes the streak from /api/dashboard; no data fetching.
 * Hidden when there's no live streak (streak < 1).
 */
export type ChecklistStreakData = {
  streak: number
  completedToday: boolean
}

export function ChecklistStreakChip({ data }: { data: ChecklistStreakData }) {
  const { t, tPlural } = useTranslation('dashboard')
  const { streak, completedToday } = data
  if (streak < 1) return null

  return (
    <Link
      href="/checklist"
      data-tour="streak-chip"
      className="flex items-center justify-between gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 mb-4 active:bg-orange-100"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-2xl shrink-0" aria-hidden>
          🔥
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-orange-900">
            {tPlural('streak_title', streak, { count: streak })}
          </p>
          <p className="text-xs text-orange-700">
            {completedToday ? t('streak_done_today') : t('streak_keep_going')}
          </p>
        </div>
      </div>
      <span className="text-orange-400 text-lg shrink-0">&rsaquo;</span>
    </Link>
  )
}
