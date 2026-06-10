'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ProductWithStock } from '@/lib/db/stock'
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner'
import { BackButton } from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import { useTranslation } from '@/components/LanguageProvider'
import { useCachedData } from '@/hooks/useCachedData'

type Tab = 'all' | 'low' | 'expiring'

interface StockData {
  products: ProductWithStock[]
  threshold: number
  expiring_count?: number
  profit_tracking_enabled?: boolean
  products_missing_cost?: number
  products_missing_supplier?: number
  suppliers_count?: number
}

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
  const { t: tp } = useTranslation('products')
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [scanning, setScanning] = useState(false)

  // Cache-first: paint the last-known stock list instantly, revalidate in the
  // background, and re-fetch on resume / mutation. (Phase 44b)
  const { data, loading, error } = useCachedData<StockData>('stock', () =>
    fetch('/api/stock', { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error('load failed')
      return r.json()
    }),
  )

  const products = data?.products ?? []
  const threshold = data?.threshold ?? 5
  const expiryCount = data?.expiring_count ?? 0
  const profitTrackingEnabled = Boolean(data?.profit_tracking_enabled)
  const productsMissingCost = data?.products_missing_cost ?? 0
  const productsMissingSupplier = data?.products_missing_supplier ?? 0
  const suppliersCount = data?.suppliers_count ?? 0

  // Expiry data (loaded lazily when tab selected)
  const [expiringProducts, setExpiringProducts] = useState<ExpiringProduct[]>([])
  const [expiryLoaded, setExpiryLoaded] = useState(false)

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
    <main className="px-4 pt-10 pb-36 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BackButton fallbackHref="/inventory" />
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        </div>
        <button
          onClick={() => setScanning(true)}
          data-tour="stock-scan"
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-brand px-4 py-2 rounded-full active:bg-brand-hover"
        >
          {t('btn_scan')}
        </button>
      </div>

      {/* Missing cost — mirror /products card */}
      {!loading && profitTrackingEnabled && productsMissingCost > 0 && (
        <Link
          href="/products/missing-cost"
          className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 active:bg-amber-100"
        >
          <p className="text-sm font-semibold text-amber-900 min-w-0 pr-3">
            {tp('missing_cost_banner', { count: productsMissingCost })}
          </p>
          <span className="text-amber-400 text-xl shrink-0">&rsaquo;</span>
        </Link>
      )}

      {/* Missing supplier — mirror /products card. Suppressed when shop has 0 suppliers (show "add first supplier" instead). */}
      {!loading && suppliersCount === 0 ? (
        <Link
          href="/suppliers/new"
          className="block bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4 active:bg-gray-100"
        >
          <p className="text-sm font-semibold text-gray-800">{tp('add_first_supplier_tip')}</p>
          <p className="text-xs text-gray-600 mt-1">{tp('add_first_supplier_btn')}</p>
        </Link>
      ) : !loading && productsMissingSupplier > 0 ? (
        <Link
          href="/products/missing-supplier"
          className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4 active:bg-gray-100"
        >
          <p className="text-sm font-semibold text-gray-800 min-w-0 pr-3">
            {tp('missing_supplier_banner', { count: productsMissingSupplier })}
          </p>
          <span className="text-gray-400 text-xl shrink-0">&rsaquo;</span>
        </Link>
      ) : null}

      {/* Summary strip */}
      {!loading && !error && (
        <div data-tour="stock-summary" className="grid grid-cols-4 gap-2 mb-5">
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
        data-tour="stock-search"
        className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand mb-3"
      />

      {/* Tabs */}
      <div data-tour="stock-tabs" className="flex gap-2 mb-4">
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

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4 mb-4">{t('error_load')}</div>
      )}

      {/* Expiring tab */}
      {!loading && !error && tab === 'expiring' && (
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
      {!loading && !error && tab !== 'expiring' && filtered.length === 0 && (
        <p className="text-center text-gray-400 text-sm mt-12">
          {tab === 'low' ? t('empty_low') : t('empty_all')}
        </p>
      )}

      {!loading && !error && tab !== 'expiring' && filtered.length > 0 && (
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
      {!loading && !error && outCount >= 3 && (
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
