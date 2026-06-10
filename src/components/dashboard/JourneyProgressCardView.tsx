'use client'

import Link from 'next/link'
import { Wallet } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'

/**
 * Presentational journey-progress card (Phase 44 App Shell). Renders X of Y
 * steps + next-step CTA from the /api/dashboard summary; no data fetching.
 */
export type JourneyCardData = {
  completed: number
  total: number
  nextKey: string | null
  allDone: boolean
  showFundTeaser: boolean
}

export function JourneyProgressCardView({ data }: { data: JourneyCardData }) {
  const { t } = useTranslation('dashboard')
  const { completed, total, nextKey, allDone, showFundTeaser } = data
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div data-tour="journey-card" className="bg-white border border-gray-100 rounded-2xl mb-4 overflow-hidden">
      <Link href="/compliance/journey" className="block p-4 active:bg-gray-50">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-sm font-bold text-gray-900">{t('journey_card_title')}</p>
          <p className="text-xs text-gray-500">{t('journey_card_count', { completed, total })}</p>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full ${allDone ? 'bg-green-500' : 'bg-brand'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {allDone ? (
          <p className="text-sm text-green-700 font-medium">{t('journey_card_all_done')}</p>
        ) : nextKey ? (
          <p className="text-sm text-gray-700">
            <span className="text-gray-500">{t('journey_card_next_label')} </span>
            <span className="font-semibold">{t(`step_${nextKey}_title`)}</span>
            <span className="text-brand ml-1">{t('journey_card_continue_arrow')}</span>
          </p>
        ) : null}
      </Link>
      {showFundTeaser && (
        <Link
          href="/compliance/fund"
          className="flex items-center gap-1.5 px-4 py-2 text-xs text-amber-700 bg-amber-50 border-t border-amber-100 active:bg-amber-100"
        >
          <Wallet className="w-3.5 h-3.5" strokeWidth={1.75} />
          {t('journey_card_fund_teaser')}
        </Link>
      )}
    </div>
  )
}
