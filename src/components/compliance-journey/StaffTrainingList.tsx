'use client'

/**
 * Phase 37c — Step 6 staff-training tracker.
 *
 * Renders a simple list of active tellers with a trained / not-trained toggle.
 * PATCHes /api/tellers/[id]/training and refreshes on success so the parent
 * server-rendered list reflects the new state.
 */

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'
import { useTranslation } from '@/components/LanguageProvider'
import type { Teller } from '@/types'

interface Props {
  tellers: Teller[]
}

export function StaffTrainingList({ tellers }: Props) {
  const { t } = useTranslation('compliance-journey')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(teller: Teller) {
    setError(null)
    setBusyId(teller.id)
    const trained = !teller.food_safety_trained_at
    const res = await fetch(`/api/tellers/${teller.id}/training`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trained }),
    })
    setBusyId(null)
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null
      setError(j?.error ?? t('staff_error_generic'))
      return
    }
    startTransition(() => router.refresh())
  }

  if (tellers.length === 0) {
    return (
      <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
        {t('staff_empty')}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <ul className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {tellers.map((teller) => {
          const trained = !!teller.food_safety_trained_at
          const trainedDate = teller.food_safety_trained_at
            ? formatInTimeZone(teller.food_safety_trained_at, SAST_TZ, 'd MMM yyyy')
            : null
          return (
            <li
              key={teller.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {teller.name}
                </p>
                {trained ? (
                  <p className="text-xs text-green-700 mt-0.5">
                    ✅ {t('staff_trained_on', { date: trainedDate ?? '' })}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t('staff_not_trained')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => toggle(teller)}
                disabled={isPending || busyId === teller.id}
                className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                  trained
                    ? 'border-gray-200 text-gray-600 active:bg-gray-50'
                    : 'border-blue-200 text-blue-700 active:bg-blue-50'
                }`}
              >
                {trained ? t('staff_btn_clear') : t('staff_btn_mark_trained')}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
