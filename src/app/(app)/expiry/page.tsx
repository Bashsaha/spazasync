'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { ExpiryProductDetail, BatchDetail } from '@/types'
import { useTranslation } from '@/components/LanguageProvider'
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible'

type UrgencyGroup = 'expired' | 'expiring_soon' | 'ok'

const groupColors: Record<UrgencyGroup, { bg: string; border: string; text: string; badge: string; labelKey: string }> = {
  expired: {
    labelKey: 'group_expired',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-700',
  },
  expiring_soon: {
    labelKey: 'group_expiring_soon',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-700',
  },
  ok: {
    labelKey: 'group_ok',
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    badge: 'bg-green-100 text-green-700',
  },
}

function useRelativeExpiryLabel() {
  const { t, tPlural, locale } = useTranslation('expiry')

  return function formatExpiryLabel(dateStr: string): string {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiry = new Date(dateStr + 'T00:00:00')
    const diffMs = expiry.getTime() - today.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < -1) return t('rel_days_ago_other', { count: Math.abs(diffDays) })
    if (diffDays === -1) return t('rel_yesterday')
    if (diffDays === 0) return t('rel_today')
    if (diffDays === 1) return t('rel_tomorrow')
    if (diffDays <= 7) return t('rel_in_days', { count: diffDays })
    if (diffDays <= 30) {
      const weeks = Math.floor(diffDays / 7)
      return tPlural('rel_in_weeks', weeks, { count: weeks })
    }
    const d = new Date(dateStr + 'T00:00:00')
    const localeTag = locale === 'en' ? 'en-ZA' : locale
    return d.toLocaleDateString(localeTag, { day: 'numeric', month: 'short', year: 'numeric' })
  }
}

function BatchRow({ batch }: { batch: BatchDetail }) {
  const { tPlural } = useTranslation('expiry')
  const formatLabel = useRelativeExpiryLabel()
  const statusColors: Record<string, string> = {
    expired: 'text-red-600',
    expiring_soon: 'text-amber-600',
    ok: 'text-green-600',
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 text-sm">
      <div>
        <span className={`font-medium ${statusColors[batch.status]}`}>
          {formatLabel(batch.expiry_date)}
        </span>
        <span className="text-gray-400 ml-2 text-xs">
          {batch.expiry_date}
        </span>
      </div>
      <span className="text-gray-700 font-semibold">{tPlural('batches_units', batch.quantity, { count: batch.quantity })}</span>
    </div>
  )
}

function ProductCard({ product }: { product: ExpiryProductDetail }) {
  const { t } = useTranslation('expiry')
  const [expanded, setExpanded] = useState(false)
  const config = groupColors[product.urgency]

  const totalBatchQty = product.batches.reduce((sum, b) => sum + b.quantity, 0)

  return (
    <li className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left active:bg-gray-50"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{product.product_name}</p>
          {product.barcode && (
            <p className="text-xs text-gray-400 font-mono mt-0.5">{product.barcode}</p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${config.badge}`}>
            {t('badge_tracked', { count: totalBatchQty })}
          </span>
          <span className="text-gray-300 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          <div className="divide-y divide-gray-50">
            {product.batches.map((batch) => (
              <BatchRow key={batch.id} batch={batch} />
            ))}
          </div>
          <div className="px-3 py-3 border-t border-gray-100 space-y-2">
            <p className="text-xs text-gray-400">
              {t('total_stock', { count: product.stock_qty })}
            </p>
            {product.urgency === 'expired' && (
              <p className="text-xs text-red-600">
                {t('expired_warning')}
              </p>
            )}
            <div className="flex gap-2">
              {product.urgency === 'expired' && (
                <Link
                  href={`/stock/${product.product_id}?mode=remove&qty=${totalBatchQty}`}
                  className="flex-1 text-center bg-red-500 text-white text-sm font-semibold py-2 px-3 rounded-xl active:bg-red-600"
                >
                  {t('btn_remove_expired')}
                </Link>
              )}
              <Link
                href={`/stock/${product.product_id}`}
                className={`text-center text-sm font-semibold py-2 px-3 rounded-xl active:bg-gray-100 border border-gray-200 text-gray-700 ${product.urgency === 'expired' ? '' : 'flex-1'}`}
              >
                {t('btn_manage_stock')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

function UrgencySection({
  urgency,
  products,
}: {
  urgency: UrgencyGroup
  products: ExpiryProductDetail[]
}) {
  const { t } = useTranslation('expiry')
  const [collapsed, setCollapsed] = useState(false)
  const config = groupColors[urgency]

  if (products.length === 0) return null

  return (
    <section className="mb-6">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full flex items-center justify-between ${config.bg} ${config.border} border rounded-full px-4 py-3 mb-2`}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${config.text}`}>{t(config.labelKey)}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.badge}`}>
            {products.length}
          </span>
        </div>
        <span className="text-gray-400 text-xs">{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <ul className="space-y-2">
          {products.map((p) => (
            <ProductCard key={p.product_id} product={p} />
          ))}
        </ul>
      )}
    </section>
  )
}

export default function ExpiryPage() {
  const { t } = useTranslation('expiry')
  const [products, setProducts] = useState<ExpiryProductDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [errorKey, setErrorKey] = useState('')

  const loadExpiry = useCallback(() => {
    fetch('/api/stock/expiry', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { products: ExpiryProductDetail[] }) => {
        setProducts(data.products ?? [])
        setLoading(false)
      })
      .catch(() => {
        setErrorKey('error_load')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadExpiry()
  }, [loadExpiry])

  useRefetchOnVisible(loadExpiry)

  const expired = products.filter((p) => p.urgency === 'expired')
  const expiringSoon = products.filter((p) => p.urgency === 'expiring_soon')
  const ok = products.filter((p) => p.urgency === 'ok')

  return (
    <main className="px-4 pt-10 pb-36 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/inventory" className="flex items-center gap-1 text-gray-500 active:text-gray-700 font-medium py-1 pr-2">
          {t('back')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      </div>

      {/* Summary strip */}
      {!loading && !errorKey && products.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div
            className={`rounded-2xl p-3 border text-center ${
              expired.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
            }`}
          >
            <p className={`text-xl font-bold ${expired.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {expired.length}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{t('summary_expired')}</p>
          </div>
          <div
            className={`rounded-2xl p-3 border text-center ${
              expiringSoon.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
            }`}
          >
            <p className={`text-xl font-bold ${expiringSoon.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {expiringSoon.length}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{t('summary_expiring')}</p>
          </div>
          <div className="bg-white border-gray-100 rounded-2xl p-3 border text-center ">
            <p className="text-xl font-bold text-green-600">{ok.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('summary_ok')}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <p className="text-center text-gray-400 text-sm mt-12">{t('loading')}</p>
      )}

      {/* Error */}
      {errorKey && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4 mb-4">{t(errorKey)}</div>
      )}

      {/* Empty state */}
      {!loading && !errorKey && products.length === 0 && (
        <div className="text-center mt-16">
          <p className="text-gray-400 text-sm">{t('empty_title')}</p>
          <p className="text-gray-400 text-xs mt-2">
            {t('empty_subtitle')}
          </p>
        </div>
      )}

      {/* Grouped sections */}
      {!loading && !errorKey && products.length > 0 && (
        <>
          <UrgencySection urgency="expired" products={expired} />
          <UrgencySection urgency="expiring_soon" products={expiringSoon} />
          <UrgencySection urgency="ok" products={ok} />
        </>
      )}
    </main>
  )
}
