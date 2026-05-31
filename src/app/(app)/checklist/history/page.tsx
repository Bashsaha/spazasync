'use client'

import { useState } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import { BackButton } from '@/components/BackButton'
import type { DailyChecklist, ChecklistStats } from '@/types'
import { useCachedData } from '@/hooks/useCachedData'

interface HistoryEntry {
  date: string
  entry: DailyChecklist | null
}

interface HistoryResponse {
  entries: HistoryEntry[]
  stats: ChecklistStats
  days: number
}

function dayStatus(e: DailyChecklist | null): 'missed' | 'done' | 'partial' {
  if (!e) return 'missed'
  const answered = [
    e.fridge_ok,
    e.freezer_ok,
    e.surfaces_cleaned,
    e.floor_cleaned,
    e.storage_clean,
  ].filter((v) => v !== null).length
  const allCleaning = e.surfaces_cleaned && e.floor_cleaned && e.storage_clean
  const expiredOk = e.expired_items_action !== null && e.expired_items_action !== 'skipped'
  if (allCleaning && expiredOk && answered >= 3) return 'done'
  return 'partial'
}

function tempOutOfRange(
  temp: number | null,
  kind: 'fridge' | 'freezer',
): boolean {
  if (temp === null) return false
  const n = Number(temp)
  return kind === 'fridge' ? n < 1 || n > 5 : n > -18
}

export default function ChecklistHistoryPage() {
  const { t, tPlural, locale } = useTranslation('checklist')
  const [expanded, setExpanded] = useState<string | null>(null)

  // Cache-first: paint the last-known checklist history instantly, revalidate in
  // the background, re-fetch on resume / mutation. (Phase 44b)
  const { data, loading, error } = useCachedData<HistoryResponse>('checklist-history', () =>
    fetch('/api/daily-checklist/history?days=30', { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error('load failed')
      return r.json() as Promise<HistoryResponse>
    }),
  )

  const localeTag = locale === 'en' ? 'en-ZA' : locale

  if (loading) {
    return (
      <main className="px-4 pt-10 pb-32 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
        <p className="text-gray-400 text-sm">{t('loading')}</p>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="px-4 pt-10 pb-32 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton fallbackHref="/checklist" />
        </div>
        <p className="text-red-600">{t('msg_load_failed')}</p>
      </main>
    )
  }

  const { entries, stats, days } = data

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="mb-2">
        <BackButton fallbackHref="/checklist" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">{t('history_title')}</h1>
      <p className="text-sm text-gray-500 mb-6">{t('history_subtitle', { days })}</p>

      {/* Stats */}
      <section className="bg-white border border-gray-100 rounded-2xl px-4 py-4 mb-4 space-y-1">
        <p className="text-sm font-semibold text-gray-900">
          {t('history_stats_compliance', {
            done: stats.completedDays,
            total: stats.totalDays,
            pct: stats.compliancePct,
          })}
        </p>
        <p className="text-xs text-gray-600">
          {t('history_stats_cleaning', { pct: stats.cleaningRate })}
        </p>
        {stats.avgFridgeTemp !== null && (
          <p className="text-xs text-gray-600">
            {t('history_stats_avg_fridge', { temp: stats.avgFridgeTemp })}
          </p>
        )}
        {stats.avgFreezerTemp !== null && (
          <p className="text-xs text-gray-600">
            {t('history_stats_avg_freezer', { temp: stats.avgFreezerTemp })}
          </p>
        )}
        {stats.outOfRangeDays > 0 && (
          <p className="text-xs text-amber-700">
            {tPlural('history_stats_out_of_range', stats.outOfRangeDays, {
              count: stats.outOfRangeDays,
            })}
          </p>
        )}
      </section>

      {/* Daily list */}
      <section className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-100 overflow-hidden">
        {entries.map(({ date, entry }) => {
          const status = dayStatus(entry)
          const isOpen = expanded === date
          const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(localeTag, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })

          const statusDot =
            status === 'done'
              ? 'bg-green-500'
              : status === 'partial'
              ? 'bg-amber-500'
              : 'bg-red-400'

          const statusLabel =
            status === 'done'
              ? t('history_done')
              : status === 'partial'
              ? t('history_partial')
              : t('history_missed')

          return (
            <button
              key={date}
              type="button"
              onClick={() => setExpanded(isOpen ? null : date)}
              className="w-full text-left px-4 py-3 active:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${statusDot}`} aria-hidden />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{dateLabel}</p>
                  <p className="text-xs text-gray-500">{statusLabel}</p>
                </div>
                {entry && (
                  <span className="text-xs text-gray-400">{isOpen ? '−' : '+'}</span>
                )}
              </div>

              {isOpen && entry && (
                <div className="mt-3 ml-5 text-xs text-gray-600 space-y-1">
                  {entry.fridge_temp !== null && (
                    <p
                      className={
                        tempOutOfRange(Number(entry.fridge_temp), 'fridge')
                          ? 'text-amber-700'
                          : ''
                      }
                    >
                      {t('history_stats_avg_fridge', { temp: entry.fridge_temp })}
                    </p>
                  )}
                  {entry.freezer_temp !== null && (
                    <p
                      className={
                        tempOutOfRange(Number(entry.freezer_temp), 'freezer')
                          ? 'text-amber-700'
                          : ''
                      }
                    >
                      {t('history_stats_avg_freezer', { temp: entry.freezer_temp })}
                    </p>
                  )}
                  <p>
                    {t('q_surfaces')} — {entry.surfaces_cleaned ? t('opt_yes') : t('opt_no')}
                  </p>
                  <p>
                    {t('q_floor')} — {entry.floor_cleaned ? t('opt_yes') : t('opt_no')}
                  </p>
                  <p>
                    {t('q_storage')} — {entry.storage_clean ? t('opt_yes') : t('opt_no')}
                  </p>
                  {entry.expired_items_action && (
                    <p>
                      {t('section_expired')} — {t(`opt_${entry.expired_items_action}`)}
                    </p>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </section>
    </main>
  )
}
