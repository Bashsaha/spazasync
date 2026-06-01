'use client'

import Link from 'next/link'
import { formatZAR } from '@/lib/utils/currency'
import { useTranslation } from '@/components/LanguageProvider'

/** The product fields the list rows read (a superset of the typed ShopProduct —
 *  /api/products returns select('*'), so cost_price is present at runtime). */
export type ProductRow = {
  id: string
  name: string
  barcode: string | null
  price: number
  stock_qty: number
  cost_price: number | null
}

/**
 * Shared product list row — used by the products list and the missing-cost /
 * missing-supplier filtered pages (all cache-first since Phase 44b). Keeps the
 * row markup in one place so the three pages can't drift.
 */
export function ProductListRow({
  product,
  href,
  showCostPill = false,
}: {
  product: ProductRow
  href: string
  showCostPill?: boolean
}) {
  const { t } = useTranslation('products')
  return (
    <Link
      href={href}
      className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 active:bg-gray-50"
    >
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 truncate">{product.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <p className="text-xs text-gray-400 font-mono">{product.barcode || t('no_barcode')}</p>
          {showCostPill && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
              {t('missing_cost_pill')}
            </span>
          )}
        </div>
      </div>
      <div className="text-right ml-4 shrink-0">
        <p className="font-bold text-gray-900">{formatZAR(product.price)}</p>
        <p
          className={`text-xs mt-0.5 ${
            product.stock_qty <= 5 ? 'text-red-500 font-semibold' : 'text-gray-400'
          }`}
        >
          {product.stock_qty} {t('in_stock')}
        </p>
      </div>
    </Link>
  )
}
