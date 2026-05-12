'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ProductWithStock } from '@/lib/db/stock'
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner'
import { useToast } from '@/components/Toast'
import { useTranslation } from '@/components/LanguageProvider'
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible'

type Tab = 'all' | 'low' | 'expiring'

interface ExpiringProduct {
  product_id: string
  product_name: string
  barcode: string | null
  stock_qty: number
  expired_qty: number
  expiring_soon_qty: number
  earliest_expiry: string | null
}

export default function StockPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const { t, tPlural } = useTranslation('stock')
  const [products, setProducts] = useState<ProductWithStock[]>([])
  const [threshold, setThreshold] = useState(5)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorKey, setErrorKey] = useState<string>('')
  const [scanning, setScanning] = useState(false)

  // Profit tracking
  const [profitTrackingEnabled, setProfitTrackingEnabled] = useState(false)
  const [productsMissingCost, setProductsMissingCost] = useState(0)

  // Expiry data (loaded lazily when tab selected)
  const [expiringProducts, setExpiringProducts] = useState<ExpiringProduct[]>([])
  const [expiryCount, setExpiryCount] = useState(0)
  const [expiryLoaded, setExpiryLoaded] = useState(false)

  const loadStock = useCallback(() => {
    fetch('/api/stock', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { products: ProductWithStock[]; threshold: number; expiring_count?: number; profit_tracking_enabled?: boolean; products_missing_cost?: number }) => {
        setProducts(data.products ?? [])
        setThreshold(data.threshold ?? 5)
        setExpiryCount(data.expiring_count ?? 0)
        setProfitTrackingEnabled(Boolean(data.profit_tracking_enabled))
        setProductsMissingCost(data.products_missing_cost ?? 0)
        setExpiryLoaded(false)
        setLoading(false)
      })
      .catch(() => {
        setErrorKey('error_load')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadStock()
  }, [loadStock])

  useRefetchOnVisible(loadStock)

  // Load expiring products when switching to the Expiring tab
  useEffect(() => {
    if (tab !== 'expiring' || expiryLoaded) return
    fetch('/api/stock?expiring=1', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { expiring_products: ExpiringProduct[] }) => {
        setExpiringProducts(data.expiring_products ?? [])
        setExpiryLoaded(true)
      })
      .catch(() => {})
  }, [tab, expiryLoaded])

  async function handleBarcodeScan(barcode: string) {
    try {
      const res = await fetch(`/api/products?barcode=${encodeURIComponent(barcode)}`)
      if (res.ok) {
        const json = await res.json()
        if (json.products && json.products.length > 0) {
          router.push(`/stock/${json.products[0].id}`)
          return
        }
      }
      addToast(t('error_barcode_not_found'), 'error')
    } catch {
      addToast(t('error_barcode_lookup'), 'error')
    }
  }

  const filtered = products.filter((p) => {
    const matchesTab = tab === 'all' || (tab === 'low' && p.low_stock)
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode?.includes(search) ?? false)
    return matchesTab && matchesSearch
  })

  const lowCount = products.filter((p) => p.low_stock).length
  const outCount = products.filter((p) => p.stock_qty === 0).length

  return (
    <main className="px-4 pt-10 pb-36 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="flex items-center gap-1 text-gray-500 active:text-gray-700 font-medium py-1 pr-2">
            {t('back')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        </div>
        <button
          onClick={() => setScanning(true)}
          className="flex items-center gap-1.5 text-sm font-semibold text-brand border border-brand-light px-3 py-2 rounded-full active:bg-brand-light"
        >
          {t('btn_scan')}
        </button>
      </div>

      {/* Missing cost price alert */}
      {!loading && profitTrackingEnabled && productsMissingCost > 0 && (
        <Link
          href="/products?missing_cost=1"
          className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4"
        >
          <p className="text-sm font-semibold text-amber-800">
            {tPlural('missing_cost_alert', productsMissingCost, { count: productsMissingCost })}
          </p>
          <p className="text-xs text-amber-600 mt-1">{t('missing_cost_btn')}</p>
        </Link>
      )}

      {/* Summary strip */}
      {!loading && !errorKey && (
        <div className="grid grid-cols-4 gap-2 mb-5">
          <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center ">
            <p className="text-xl font-bold text-gray-900">{products.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('summary_products')}</p>
          </div>
          <div
            className={`rounded-2xl p-3 border text-center ${
              lowCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
            }`}
          >
            <p className={`text-xl font-bold ${lowCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {lowCount}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{t('summary_low')}</p>
          </div>
          <div
            className={`rounded-2xl p-3 border text-center ${
              outCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
            }`}
          >
            <p className={`text-xl font-bold ${outCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {outCount}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{t('summary_out')}</p>
          </div>
          <div
            className={`rounded-2xl p-3 border text-center ${
              expiryCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
            }`}
          >
            <p className={`text-xl font-bold ${expiryCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {expiryCount}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{t('summary_expiring')}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('search_placeholder')}
        aria-label={t('search_placeholder')}
        className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand mb-3"
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'low', 'expiring'] as Tab[]).map((tabId) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`px-3 py-2 rounded-full text-sm font-semibold transition-colors ${
              tab === tabId
                ? 'bg-brand text-white'
                : 'bg-white border border-gray-200 text-gray-600 active:bg-gray-50'
            }`}
          >
            {tabId === 'all'
              ? t('tab_all')
              : tabId === 'low'
              ? t('tab_low', { count: lowCount })
              : t('tab_expiring', { count: expiryCount })}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <p className="text-center text-gray-400 text-sm mt-12">{t('loading')}</p>
      )}

      {errorKey && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4 mb-4">{t(errorKey)}</div>
      )}

      {/* Expiring tab */}
      {!loading && !errorKey && tab === 'expiring' && (
        <>
          <div className="mb-4">
            <Link
              href="/expiry"
              className="inline-flex items-center gap-1 text-sm text-brand font-semibold active:text-brand-hover"
            >
              {t('expiry_see_all')}
            </Link>
          </div>
          {expiringProducts.length === 0 && expiryLoaded && (
            <p className="text-center text-gray-400 text-sm mt-8">
              {t('expiry_none')}
            </p>
          )}
          {expiringProducts.length > 0 && (
            <ul className="space-y-2">
              {expiringProducts.map((ep) => (
                <li key={ep.product_id}>
                  <Link
                    href={`/stock/${ep.product_id}`}
                    className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 active:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{ep.product_name}</p>
                      {ep.barcode && (
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{ep.barcode}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {ep.expired_qty > 0 && (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-700">
                          {t('expiry_badge_expired', { count: ep.expired_qty })}
                        </span>
                      )}
                      {ep.expiring_soon_qty > 0 && (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                          {t('expiry_badge_soon', { count: ep.expiring_soon_qty })}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* All / Low tabs */}
      {!loading && !errorKey && tab !== 'expiring' && filtered.length === 0 && (
        <p className="text-center text-gray-400 text-sm mt-12">
          {tab === 'low' ? t('empty_low') : t('empty_all')}
        </p>
      )}

      {!loading && !errorKey && tab !== 'expiring' && filtered.length > 0 && (
        <ul className="space-y-2">
          {filtered.map((p) => {
            const isOut = p.stock_qty === 0
            const isLow = p.low_stock

            return (
              <li key={p.id}>
                <Link
                  href={`/stock/${p.id}`}
                  className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 active:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{p.barcode}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <span
                      className={`text-sm font-bold px-2.5 py-1 rounded-xl ${
                        isOut
                          ? 'bg-red-100 text-red-700'
                          : isLow
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {p.stock_qty}
                    </span>
                    <span className="text-brand font-bold text-lg leading-none">›</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {/* Stock take prompt if many out of stock */}
      {!loading && !errorKey && outCount >= 3 && (
        <div className="mt-6 bg-brand-light border border-brand-light rounded-2xl p-4 text-sm text-brand-hover">
          <p className="font-semibold mb-1">{t('out_of_stock_prompt', { count: outCount })}</p>
          <p className="text-brand-hover mb-3">
            {t('out_of_stock_desc')}
          </p>
          <Link
            href="/stock-take"
            className="inline-block bg-brand text-white text-sm font-semibold px-4 py-2 rounded-full active:bg-brand-hover"
          >
            {t('btn_run_stock_take')}
          </Link>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-6">
        {t('threshold_footer', { threshold })}
      </p>

      {scanning && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setScanning(false)}
        />
      )}
    </main>
  )
}
