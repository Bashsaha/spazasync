'use client'

import { useCachedData } from '@/hooks/useCachedData'
import { useTranslation } from '@/components/LanguageProvider'
import { Skeleton } from '@/components/Skeleton'
import { TodaySummaryView } from '@/components/dashboard/TodaySummaryView'
import type { DailySummaryData, LowStockItem, ExpiringProductAlert } from '@/types'

/**
 * Phase 44b — cache-first dashboard summary cards (Today + Low stock + Expiring).
 *
 * Replaces three Suspense-wrapped server components that each blocked on the
 * network before painting. Now ALL three cards come from a single cached
 * snapshot of `GET /api/summary/daily` (which already returns sales + lowStock +
 * expiring + the profit flag), so a repeat open / resume paints them instantly
 * from localStorage and revalidates in the background. One fetch, not three.
 */

type SummaryResponse = {
  sales: DailySummaryData
  lowStock: LowStockItem[]
  expiring: ExpiringProductAlert[]
  profitTrackingEnabled: boolean
}

export function DashboardSummaryCards() {
  const { t, tPlural } = useTranslation('dashboard')
  const { data, loading } = useCachedData<SummaryResponse>('dashboard-summary', () =>
    fetch('/api/summary/daily', { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error('load failed')
      return r.json() as Promise<SummaryResponse>
    }),
  )

  // First-ever load on a device with no snapshot: show the Today skeleton only
  // (the alert cards are conditional, so there's nothing to placeholder there).
  if (loading) return <Skeleton className="h-24 rounded-2xl mb-4" />
  // A failed refresh with nothing cached: render nothing (matches the old
  // server components' catch → null behaviour — the dashboard stays usable).
  if (!data) return null

  const lowStock = data.lowStock ?? []
  const expiring = data.expiring ?? []

  const outOfStock = lowStock.filter((p) => p.stock_qty === 0)
  const lowOnly = lowStock.filter((p) => p.stock_qty > 0)

  const expired = expiring.filter((p) => p.expired_qty > 0)
  const expiringSoon = expiring.filter((p) => p.expiring_soon_qty > 0 && p.expired_qty === 0)

  return (
    <>
      <TodaySummaryView summary={data.sales} profitTrackingEnabled={data.profitTrackingEnabled} />

      {lowStock.length > 0 && (
        <a
          href="/stock?tab=low"
          className="block bg-red-50 border border-red-100 rounded-2xl p-4 mb-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-red-700 mb-1">{t('low_stock_title')}</p>
              {outOfStock.length > 0 && (
                <p className="text-xs text-red-600">
                  {tPlural('low_stock_out', outOfStock.length, { count: outOfStock.length })}
                </p>
              )}
              {lowOnly.length > 0 && (
                <p className="text-xs text-brand-hover">
                  {tPlural('low_stock_low', lowOnly.length, { count: lowOnly.length })}
                </p>
              )}
              <ul className="mt-2 space-y-0.5">
                {lowStock.slice(0, 4).map((item) => (
                  <li key={item.name} className="text-xs text-gray-600">
                    &bull; {item.name}{' '}
                    <span className={item.stock_qty === 0 ? 'text-red-600 font-semibold' : 'text-brand'}>
                      {item.stock_qty === 0
                        ? `(${t('low_stock_badge_out')})`
                        : `(${t('low_stock_badge_left', { count: item.stock_qty })})`}
                    </span>
                  </li>
                ))}
                {lowStock.length > 4 && (
                  <li className="text-xs text-gray-400">
                    {t('low_stock_more', { count: lowStock.length - 4 })}
                  </li>
                )}
              </ul>
            </div>
            <span className="text-gray-300 text-lg">&rsaquo;</span>
          </div>
        </a>
      )}

      {expiring.length > 0 && (
        <a
          href="/expiry"
          className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">{t('expiring_title')}</p>
              {expired.length > 0 && (
                <p className="text-xs text-red-600">{t('expiring_expired', { count: expired.length })}</p>
              )}
              {expiringSoon.length > 0 && (
                <p className="text-xs text-amber-700">{t('expiring_soon', { count: expiringSoon.length })}</p>
              )}
              <ul className="mt-2 space-y-0.5">
                {expiring.slice(0, 4).map((item) => (
                  <li key={item.name} className="text-xs text-gray-600">
                    &bull; {item.name}{' '}
                    <span className={item.expired_qty > 0 ? 'text-red-600 font-semibold' : 'text-amber-600'}>
                      {item.expired_qty > 0
                        ? `(${t('expiring_expired', { count: item.expired_qty })})`
                        : `(${t('expiring_soon', { count: item.expiring_soon_qty })})`}
                    </span>
                  </li>
                ))}
                {expiring.length > 4 && (
                  <li className="text-xs text-gray-400">+{expiring.length - 4}…</li>
                )}
              </ul>
            </div>
            <span className="text-gray-300 text-lg">&rsaquo;</span>
          </div>
        </a>
      )}
    </>
  )
}
