'use client'

import { useCachedData } from '@/hooks/useCachedData'
import { useTranslation } from '@/components/LanguageProvider'
import { Skeleton } from '@/components/Skeleton'

type InventorySummary = { total: number; low: number; expiring: number }

/**
 * Cache-first version of the Inventory hub's 3-count strip (Phase 44b). Paints
 * instantly from the last snapshot, revalidates in the background. Mounted by
 * the (server-rendered) inventory page, which keeps the role-gating + tiles.
 */
export function InventorySummaryStrip() {
  const { t, tPlural } = useTranslation('inventory')
  const { data, loading } = useCachedData<InventorySummary>('inventory-summary', () =>
    fetch('/api/inventory/summary', { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error('load failed')
      return r.json() as Promise<InventorySummary>
    }),
  )

  if (loading) return <Skeleton className="h-[76px] rounded-2xl mb-5" />

  const total = data?.total ?? 0
  const low = data?.low ?? 0
  const expiring = data?.expiring ?? 0

  return (
    <div className="grid grid-cols-3 gap-2 mb-5">
      <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center ">
        <p className="text-xl font-bold text-gray-900">{total}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-tight">{tPlural('summary_total', total)}</p>
      </div>
      <div
        className={`rounded-2xl p-3 text-center border ${
          low > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
        }`}
      >
        <p className={`text-xl font-bold ${low > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{low}</p>
        <p className={`text-xs mt-0.5 leading-tight ${low > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
          {t('summary_low')}
        </p>
      </div>
      <div
        className={`rounded-2xl p-3 text-center border ${
          expiring > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
        }`}
      >
        <p className={`text-xl font-bold ${expiring > 0 ? 'text-red-700' : 'text-gray-900'}`}>
          {expiring}
        </p>
        <p
          className={`text-xs mt-0.5 leading-tight ${expiring > 0 ? 'text-red-700' : 'text-gray-500'}`}
        >
          {t('summary_expiring')}
        </p>
      </div>
    </div>
  )
}
