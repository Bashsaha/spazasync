'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCachedData } from '@/hooks/useCachedData'
import { useTranslation } from '@/components/LanguageProvider'
import { formatZAR } from '@/lib/utils/currency'
import { CatalogImportSheet } from '@/components/products/CatalogImportSheet'
import { BackButton } from '@/components/BackButton'
import { Skeleton } from '@/components/Skeleton'
import { ProductListRow, type ProductRow } from '@/components/products/ProductListRow'

const EMPTY: ProductRow[] = []

type SettingsResp = {
  profit_tracking_enabled?: boolean
  products_missing_cost?: number
  products_missing_supplier?: number
  suppliers_count?: number
}

export default function ProductsPage() {
  const { t } = useTranslation('products')

  // Search is now client-side (debounced into the cache key) — instant paint
  // from the cached default list, no form round-trip.
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(id)
  }, [search])

  const { data: productsData, loading } = useCachedData<{ products: ProductRow[] }>(
    `products-list:${debounced}`,
    () =>
      fetch(`/api/products${debounced ? `?search=${encodeURIComponent(debounced)}` : ''}`, {
        cache: 'no-store',
      }).then((r) => {
        if (!r.ok) throw new Error('load failed')
        return r.json() as Promise<{ products: ProductRow[] }>
      }),
  )
  const products = productsData?.products ?? EMPTY

  // Banner counts + profit flag come from /api/settings (SW-cached, and it
  // already returns all three counts — see the settings route).
  const { data: settings } = useCachedData<SettingsResp>('settings', () =>
    fetch('/api/settings', { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error('load failed')
      return r.json() as Promise<SettingsResp>
    }),
  )
  const profitTracking = Boolean(settings?.profit_tracking_enabled)
  const missingCostCount = settings?.products_missing_cost ?? 0
  const missingSupplierCount = settings?.products_missing_supplier ?? 0
  const suppliersCount = settings?.suppliers_count ?? 0

  return (
    <main className="px-4 pt-10 pb-36 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <BackButton fallbackHref="/inventory" />
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-6">
        <CatalogImportSheet />
        <Link
          href="/products/new"
          data-tour="product-add"
          className="flex items-center justify-center bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-full active:bg-brand-hover"
        >
          {t('btn_add')}
        </Link>
      </div>

      {/* Missing-cost gateway card — opens dedicated filtered page */}
      {profitTracking && missingCostCount > 0 && (
        <Link
          href="/products/missing-cost"
          className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 active:bg-amber-100"
        >
          <p className="text-sm font-semibold text-amber-900 min-w-0 pr-3">
            {t('missing_cost_banner', { count: missingCostCount })}
          </p>
          <span className="text-amber-400 text-xl shrink-0">&rsaquo;</span>
        </Link>
      )}

      {/* Missing-supplier tip (soft gray — supplier gaps are operational, not a data integrity issue) */}
      {suppliersCount === 0 ? (
        <Link
          href="/suppliers/new"
          className="block bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4 active:bg-gray-100"
        >
          <p className="text-sm font-semibold text-gray-800">{t('add_first_supplier_tip')}</p>
          <p className="text-xs text-gray-600 mt-1">{t('add_first_supplier_btn')}</p>
        </Link>
      ) : missingSupplierCount > 0 ? (
        <Link
          href="/products/missing-supplier"
          className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4 active:bg-gray-100"
        >
          <p className="text-sm font-semibold text-gray-800 min-w-0 pr-3">
            {t('missing_supplier_banner', { count: missingSupplierCount })}
          </p>
          <span className="text-gray-400 text-xl shrink-0">&rsaquo;</span>
        </Link>
      ) : null}

      <div className="mb-4">
        <input
          name="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search_placeholder')}
          className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      {loading ? (
        <ul className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i}>
              <Skeleton className="h-[68px] rounded-2xl" />
            </li>
          ))}
        </ul>
      ) : products.length === 0 ? (
        <p className="text-center text-gray-400 text-sm mt-12">
          {debounced ? t('empty_search') : t('empty_no_search')}
        </p>
      ) : (
        <ul className="space-y-2">
          {products.map((p) => (
            <li key={p.id}>
              <ProductListRow
                product={p}
                href={`/products/${p.id}`}
                showCostPill={profitTracking && p.cost_price == null}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
