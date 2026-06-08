'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { ShoppingCart, Calendar, BarChart3 } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'
import { useCachedData } from '@/hooks/useCachedData'
import { Skeleton } from '@/components/Skeleton'
import { TodaySummaryView } from '@/components/dashboard/TodaySummaryView'
import { WeeklySalesChart } from '@/components/dashboard/WeeklySalesChart'
import { LatestSalesView } from '@/components/dashboard/LatestSalesView'
import type { DailySummaryData, WeeklyDataPoint, RecentSale } from '@/types'

/**
 * /sales hub — client cache-first (paints the last snapshot instantly, then
 * revalidates) so it opens immediately on repeat visits and never server-renders
 * into a sleeping radio on resume (the old slow + "error, try again" behaviour).
 * Data comes from the consolidated GET /api/sales/hub. Owner/admin only —
 * tellers are locked to /sale by proxy.ts and the endpoint 403s them.
 */
interface SalesHubPayload {
  profitTrackingEnabled: boolean
  summary: DailySummaryData
  weekly: WeeklyDataPoint[]
  topProducts: { name: string; totalQty: number }[]
  recentSales: RecentSale[]
}

export default function SalesHubPage() {
  const { t } = useTranslation('sales')

  const fetcher = useCallback(async (): Promise<SalesHubPayload> => {
    const res = await fetch('/api/sales/hub')
    if (!res.ok) throw new Error('hub')
    return res.json() as Promise<SalesHubPayload>
  }, [])

  const { data, loading } = useCachedData<SalesHubPayload>('sales-hub', fetcher)

  return (
    <main className="px-4 pt-10 pb-44 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('hint')}</p>
      </div>

      {/* Big primary CTA — Start a Sale (always visible, no data dependency) */}
      <Link
        href="/sale"
        className="flex items-center justify-between bg-brand text-white rounded-full p-5 mb-4 active:bg-brand-hover"
      >
        <div>
          <p className="font-bold text-lg">{t('hub_start_sale')}</p>
          <p className="text-brand-light text-sm">{t('hub_start_sale_desc')}</p>
        </div>
        <ShoppingCart className="w-7 h-7" strokeWidth={2} />
      </Link>

      {loading || !data ? (
        <>
          <Skeleton className="h-24 rounded-2xl mb-4" />
          <Skeleton className="h-48 rounded-2xl mb-4" />
          <Skeleton className="h-40 rounded-2xl mb-4" />
        </>
      ) : (
        <>
          <TodaySummaryView
            summary={data.summary}
            profitTrackingEnabled={data.profitTrackingEnabled}
          />

          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              {t('weekly_title')}
            </p>
            <WeeklySalesChart
              data={data.weekly}
              labels={{
                noData: t('weekly_no_data'),
                saleOne: t('weekly_sale_one'),
                saleOther: t('weekly_sale_other'),
              }}
            />
          </div>

          {data.topProducts.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                {t('top_products_title')}
              </p>
              <ol className="space-y-2">
                {data.topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-300 w-4">{i + 1}.</span>
                      <span className="text-sm text-gray-800">{p.name}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {p.totalQty} {t('top_products_sold')}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <LatestSalesView sales={data.recentSales} />
        </>
      )}

      {/* View by date — drill-down link */}
      <Link
        href="/sales/history"
        data-tour="sales-history"
        className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 active:bg-gray-50 mb-3"
      >
        <div>
          <p className="font-bold text-gray-900">{t('hub_view_history')}</p>
          <p className="text-gray-400 text-sm">{t('hub_view_history_desc')}</p>
        </div>
        <Calendar className="w-7 h-7 text-brand" strokeWidth={1.75} />
      </Link>

      {/* Sales statistics — period analytics drill-down */}
      <Link
        href="/sales/statistics"
        className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 active:bg-gray-50"
      >
        <div>
          <p className="font-bold text-gray-900">{t('hub_statistics')}</p>
          <p className="text-gray-400 text-sm">{t('hub_statistics_desc')}</p>
        </div>
        <BarChart3 className="w-7 h-7 text-brand" strokeWidth={1.75} />
      </Link>
    </main>
  )
}
