'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCachedData } from '@/hooks/useCachedData'
import { useTranslation } from '@/components/LanguageProvider'
import { BackButton } from '@/components/BackButton'
import { Skeleton } from '@/components/Skeleton'
import { ProductListRow, type ProductRow } from '@/components/products/ProductListRow'

const EMPTY: ProductRow[] = []

export default function ProductsMissingCostPage() {
  const { t } = useTranslation('products')
  const router = useRouter()

  const { data, loading } = useCachedData<{ products: ProductRow[] }>('products:missing-cost', () =>
    fetch('/api/products?missing_cost=1', { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error('load failed')
      return r.json() as Promise<{ products: ProductRow[] }>
    }),
  )
  const products = data?.products ?? EMPTY

  // Profit-tracking guard: this page is only meaningful when profit tracking is
  // on. Settings is SW-cached + returns the flag; redirect once we know it's off.
  const { data: settings } = useCachedData<{ profit_tracking_enabled?: boolean }>('settings', () =>
    fetch('/api/settings', { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error('load failed')
      return r.json() as Promise<{ profit_tracking_enabled?: boolean }>
    }),
  )
  useEffect(() => {
    if (settings && !settings.profit_tracking_enabled) router.replace('/products')
  }, [settings, router])

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <BackButton fallbackHref="/products" />
        <h1 className="text-2xl font-bold text-gray-900">{t('missing_cost_page_title')}</h1>
      </div>

      {loading ? (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Skeleton className="h-[68px] rounded-2xl" />
            </li>
          ))}
        </ul>
      ) : products.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-green-800">{t('missing_cost_all_done')}</p>
        </div>
      ) : (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
            <p className="text-sm font-semibold text-amber-900">
              {t('missing_cost_filter_active', { count: products.length })}
            </p>
          </div>
          <ul className="space-y-2">
            {products.map((p) => (
              <li key={p.id}>
                <ProductListRow
                  product={p}
                  href={`/products/${p.id}?return=missing_cost`}
                  showCostPill
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
