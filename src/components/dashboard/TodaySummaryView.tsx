'use client'

import { formatZAR } from '@/lib/utils/currency'
import { useTranslation } from '@/components/LanguageProvider'
import type { DailySummaryData } from '@/types'

/**
 * Pure presentational "Today" card — shared by the cache-first dashboard
 * ([DashboardSummaryCards]) and the still-server-streamed /sales hub
 * ([TodaySummary]). Takes already-fetched data; uses the client i18n context
 * so both call sites render identical copy without duplicating the markup.
 */
export function TodaySummaryView({
  summary,
  profitTrackingEnabled = false,
}: {
  summary: DailySummaryData
  profitTrackingEnabled?: boolean
}) {
  const { t, tPlural } = useTranslation('dashboard')

  // When profit tracking is on, show Profit in place of Tellers (tellers are
  // visible on the sale page). Keep the three-column layout intact.
  const showProfit = profitTrackingEnabled

  return (
    <div className="bg-brand-light border border-brand-light rounded-2xl p-4 mb-4">
      <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-3">
        {t('today')}
      </p>
      <div className="flex gap-4">
        <div className="flex-1">
          <p className="text-2xl font-bold text-gray-900">{formatZAR(summary.totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('today_made')}</p>
        </div>
        <div className="flex-1">
          <p className="text-2xl font-bold text-gray-900">{summary.salesCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {tPlural('today_sale', summary.salesCount)}
          </p>
        </div>
        {showProfit ? (
          <div className="flex-1">
            <p className={`text-2xl font-bold ${summary.totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {formatZAR(summary.totalProfit)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{t('today_profit')}</p>
          </div>
        ) : (
          summary.tellerCount > 0 && (
            <div className="flex-1">
              <p className="text-2xl font-bold text-gray-900">{summary.tellerCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {tPlural('today_teller', summary.tellerCount)}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
