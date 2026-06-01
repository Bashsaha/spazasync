'use client'

import Link from 'next/link'
import { useCachedData } from '@/hooks/useCachedData'
import { useTranslation } from '@/components/LanguageProvider'
import { BackButton } from '@/components/BackButton'
import { Skeleton } from '@/components/Skeleton'
import { ProductListRow, type ProductRow } from '@/components/products/ProductListRow'

const EMPTY: ProductRow[] = []

export default function ProductsMissingSupplierPage() {
  const { t } = useTranslation('products')

  const { data, loading } = useCachedData<{ products: ProductRow[] }>(
    'products:missing-supplier',
    () =>
      fetch('/api/products?missing_supplier=1', { cache: 'no-store' }).then((r) => {
        if (!r.ok) throw new Error('load failed')
        return r.json() as Promise<{ products: ProductRow[] }>
      }),
  )
  const products = data?.products ?? EMPTY

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <BackButton fallbackHref="/products" />
        <h1 className="text-2xl font-bold text-gray-900">{t('missing_supplier_page_title')}</h1>
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
          <p className="text-sm font-semibold text-green-800">{t('missing_supplier_all_done')}</p>
        </div>
      ) : (
        <>
          <Link
            href="/suppliers/assign"
            className="block bg-brand-light border border-brand-light rounded-2xl p-4 mb-4 active:bg-brand-light"
          >
            <p className="text-sm font-semibold text-brand-hover">{t('missing_supplier_assign_btn')}</p>
          </Link>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4">
            <p className="text-sm font-semibold text-gray-800">
              {t('missing_supplier_filter_active', { count: products.length })}
            </p>
          </div>
          <ul className="space-y-2">
            {products.map((p) => (
              <li key={p.id}>
                <ProductListRow
                  product={p}
                  href={`/products/${p.id}?return=missing_supplier`}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
