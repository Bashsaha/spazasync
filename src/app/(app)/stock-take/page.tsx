'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check } from 'lucide-react'
import type { Product } from '@/types'
import { useTranslation } from '@/components/LanguageProvider'
import { BackButton } from '@/components/BackButton'
import { FullScreenSpinner } from '@/components/Spinner'
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible'
import { useUserRole } from '@/hooks/useUserRole'
import { createClient } from '@/lib/supabase/client'
import { STOCK_TAKE_LOSS_REASONS, type StockTakeLossReason } from '@/lib/validation/schemas'
import { emitDataChanged } from '@/lib/events'

export default function StockTakePage() {
  const router = useRouter()
  const { t, tPlural } = useTranslation('stock')
  const role = useUserRole()
  const isTeller = role === 'teller'
  const [products, setProducts] = useState<Product[]>([])
  const [counts, setCounts] = useState<Record<string, string>>({})
  // Why a count came in lower than current stock, keyed by product id.
  const [reasons, setReasons] = useState<Record<string, StockTakeLossReason>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [errorRaw, setErrorRaw] = useState('')
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [profitTrackingEnabled, setProfitTrackingEnabled] = useState(false)
  const [productsMissingCost, setProductsMissingCost] = useState(0)
  const [productsMissingSupplier, setProductsMissingSupplier] = useState(0)
  const [suppliersCount, setSuppliersCount] = useState(0)
  const [shopId, setShopId] = useState<string | null>(null)

  const loadStockTake = useCallback((fresh = false) => {
    // Products are all a teller needs to count. /api/settings is fetched
    // separately, owner-only — for a teller the proxy redirects it to /sale
    // (a wasted full render) and it only feeds owner nudges anyway.
    //
    // `fresh` is for realtime-triggered refetches: /api/products is served
    // stale-while-revalidate by the service worker, so a plain refetch returns
    // the PREVIOUS list and the new numbers only appear a beat later. When we
    // KNOW the data just changed (a realtime products event), bust the SW with
    // a unique query param so we get the current numbers immediately. The
    // initial open + visibility refreshes keep the cached (instant) path, so
    // open speed is unchanged.
    const url = fresh ? `/api/products?_fresh=${Date.now()}` : '/api/products'
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((productsData) => {
        setProducts((productsData.products ?? productsData) as Product[])
        setErrorKey(null)
      })
      .catch(() => setErrorKey('stock_take_error_load'))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    loadStockTake()
  }, [loadStockTake])

  useRefetchOnVisible(loadStockTake)

  // Owner/admin-only: settings drive the missing-cost / supplier nudges, which
  // tellers never see. Skipping it for tellers avoids a redirect round-trip.
  useEffect(() => {
    if (role !== 'owner' && role !== 'admin') return
    fetch('/api/settings')
      .then((r) => r.json())
      .then((settingsData) => {
        if (!settingsData) return
        setProfitTrackingEnabled(Boolean(settingsData.profit_tracking_enabled))
        setProductsMissingCost(settingsData.products_missing_cost ?? 0)
        setProductsMissingSupplier(settingsData.products_missing_supplier ?? 0)
        setSuppliersCount(settingsData.suppliers_count ?? 0)
      })
      .catch(() => {})
  }, [role])

  // Resolve the shop id from the local session (for the realtime channel).
  useEffect(() => {
    let cancelled = false
    async function resolveShop() {
      try {
        const { data } = await createClient().auth.getSession()
        if (!cancelled) setShopId((data.session?.user.app_metadata?.shop_id as string) ?? null)
      } catch {
        /* no session */
      }
    }
    resolveShop()
    return () => {
      cancelled = true
    }
  }, [])

  // Realtime: when stock changes on another device (someone else saves a count,
  // or a sale deducts stock), refresh the "current" column live so two people
  // counting at the same time always see up-to-date numbers. Typed counts are
  // kept (they're keyed by product id, separate from the products array), so a
  // refresh mid-count never wipes what the user has entered. Debounced.
  const rtDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!shopId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`stocktake-products:${shopId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `shop_id=eq.${shopId}` },
        () => {
          if (rtDebounce.current) clearTimeout(rtDebounce.current)
          // Short debounce just to coalesce the burst of product UPDATEs from
          // one save; force a cache-busting (fresh) fetch so the new numbers
          // show at once, not after the SW's background revalidate.
          rtDebounce.current = setTimeout(() => loadStockTake(true), 250)
        },
      )
      .subscribe()
    return () => {
      if (rtDebounce.current) clearTimeout(rtDebounce.current)
      supabase.removeChannel(channel)
    }
  }, [shopId, loadStockTake])

  const countedItems = Object.values(counts).filter((v) => v !== '').length

  function handleCount(productId: string, value: string) {
    setCounts((prev) => ({ ...prev, [productId]: value }))
    // If the count is no longer lower than current stock, drop any reason —
    // it only applies to shrinkage.
    const product = products.find((p) => p.id === productId)
    if (product) {
      const n = parseInt(value, 10)
      const stillLower = value !== '' && !isNaN(n) && n < product.stock_qty
      if (!stillLower) {
        setReasons((prev) => {
          if (!(productId in prev)) return prev
          const next = { ...prev }
          delete next[productId]
          return next
        })
      }
    }
  }

  function setReason(productId: string, reason: StockTakeLossReason) {
    setReasons((prev) => ({ ...prev, [productId]: reason }))
  }

  function markAllCorrect() {
    const next: Record<string, string> = { ...counts }
    for (const p of products) {
      if (next[p.id] === undefined || next[p.id] === '') {
        next[p.id] = String(p.stock_qty)
      }
    }
    setCounts(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorKey(null)
    setErrorRaw('')

    const counted = products.filter((p) => counts[p.id] !== undefined && counts[p.id] !== '')

    // A count lower than current stock must carry a reason (theft / waste
    // tracking). 'unsure' is always available so the user is never stuck.
    const lowerMissingReason = counted.some((p) => {
      const n = parseInt(counts[p.id], 10)
      return !isNaN(n) && n >= 0 && n < p.stock_qty && !reasons[p.id]
    })
    if (lowerMissingReason) {
      setErrorKey('stock_take_error_reason_required')
      return
    }

    const entries = counted
      .map((p) => {
        const qty_after = parseInt(counts[p.id], 10)
        const isLower = !isNaN(qty_after) && qty_after < p.stock_qty
        return {
          product_id: p.id,
          qty_after,
          ...(isLower && reasons[p.id] ? { reason: reasons[p.id] } : {}),
        }
      })
      .filter((e) => !isNaN(e.qty_after) && e.qty_after >= 0)

    if (entries.length === 0) {
      setErrorKey('stock_take_error_no_counts')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/stock-take', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.error) setErrorRaw(json.error)
        else setErrorKey('stock_take_error_save')
        return
      }
      setSavedCount(entries.length)
      emitDataChanged()
    } catch {
      setErrorKey('stock_take_error_network')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  if (savedCount !== null) {
    return (
      <main className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <Check className="w-10 h-10 text-green-700" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('stock_take_success_title')}</h1>
        <p className="text-gray-500 text-sm mb-10">
          {tPlural('stock_take_success', savedCount, { count: savedCount })}
        </p>
        <button
          onClick={() => router.push(isTeller ? '/inventory' : '/dashboard')}
          className="w-full max-w-xs bg-brand text-white font-semibold py-4 rounded-full active:bg-brand-hover"
        >
          {isTeller ? t('stock_take_btn_inventory') : t('stock_take_btn_dashboard')}
        </button>
        <button
          onClick={() => {
            setCounts({})
            setReasons({})
            setSavedCount(null)
          }}
          className="mt-4 text-sm text-gray-400 active:text-gray-600"
        >
          {t('stock_take_btn_again')}
        </button>
      </main>
    )
  }

  // ── Main form ──────────────────────────────────────────────────────────────

  return (
    <>
      {isSubmitting && <FullScreenSpinner label={t('stock_take_btn_saving')} />}
      <main className="px-4 pt-8 pb-44 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
        {/* header */}
        <div className="flex items-center gap-2 mb-1">
          <BackButton fallbackHref="/inventory" />
          <h1 className="text-2xl font-bold text-gray-900">{t('stock_take_title')}</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6 ml-12">
          {t('stock_take_subtitle')}
        </p>

        {/* Missing cost price alert (amber — gates profit dashboard). Owner-only:
            tellers can't reach /products and these are owner data-quality nudges. */}
        {!isTeller && !isLoading && profitTrackingEnabled && productsMissingCost > 0 && (
          <Link
            href="/products/missing-cost"
            className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4"
          >
            <p className="text-sm font-semibold text-amber-800">
              {tPlural('missing_cost_alert', productsMissingCost, { count: productsMissingCost })}
            </p>
            <p className="text-xs text-amber-600 mt-1">{t('missing_cost_btn')}</p>
          </Link>
        )}

        {/* Missing supplier tip (soft gray — operational, not a hard gap).
            Owner-only — tellers don't manage suppliers. */}
        {!isTeller && !isLoading && suppliersCount === 0 ? (
          <Link
            href="/suppliers/new"
            className="block bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4 active:bg-gray-100"
          >
            <p className="text-sm font-semibold text-gray-800">{t('add_first_supplier_tip')}</p>
            <p className="text-xs text-gray-600 mt-1">{t('add_first_supplier_btn')}</p>
          </Link>
        ) : !isLoading && productsMissingSupplier > 0 ? (
          <Link
            href="/suppliers/assign"
            className="block bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4 active:bg-gray-100"
          >
            <p className="text-sm font-semibold text-gray-800">
              {tPlural('missing_supplier_tip', productsMissingSupplier, {
                count: productsMissingSupplier,
              })}
            </p>
            <p className="text-xs text-gray-600 mt-1">{t('missing_supplier_btn')}</p>
          </Link>
        ) : null}

        {/* Owner-only reports: stock loss + who-counted-what history. Tellers
            only do the count itself. */}
        {!isTeller && !isLoading && products.length > 0 && (
          <>
            <Link
              href="/stock-take/loss"
              className="block bg-white border border-gray-100 rounded-2xl p-4 mb-4 active:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-3">
                  <p className="text-sm font-semibold text-gray-900">{t('loss_card_title')}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('loss_card_desc')}</p>
                </div>
                <span className="text-gray-300 text-lg shrink-0">›</span>
              </div>
            </Link>
            <Link
              href="/stock-take/history"
              className="block bg-white border border-gray-100 rounded-2xl p-4 mb-4 active:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-3">
                  <p className="text-sm font-semibold text-gray-900">{t('history_card_title')}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('history_card_desc')}</p>
                </div>
                <span className="text-gray-300 text-lg shrink-0">›</span>
              </div>
            </Link>
          </>
        )}

        {/* error banner */}
        {(errorKey || errorRaw) && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
            {errorRaw ? errorRaw : errorKey ? t(errorKey) : ''}
          </div>
        )}

        {/* content */}
        {isLoading ? (
          <p className="text-gray-400 text-sm text-center mt-16">{t('stock_take_loading')}</p>
        ) : products.length === 0 ? (
          <div className="text-center mt-16">
            <p className="text-gray-400 text-sm">{t('stock_take_no_products')}</p>
            <Link href="/products/new" className="text-brand text-sm mt-2 inline-block">
              {t('stock_take_add_first')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} id="stock-take-form">
            {/* progress + mark all correct */}
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-sm font-medium text-gray-600">
                {t('stock_take_progress', { counted: countedItems, total: products.length })}
              </p>
              <button
                type="button"
                onClick={markAllCorrect}
                className="text-xs font-semibold text-brand active:text-brand-hover"
              >
                {t('stock_take_mark_all_correct')}
              </button>
            </div>

            {/* table header */}
            <div className="flex items-center px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <span className="flex-1">{t('stock_take_col_product')}</span>
              <span className="w-14 text-right mr-3">{t('stock_take_col_current')}</span>
              <span className="w-16 text-center">{t('stock_take_col_count')}</span>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden">
              {products.map((p, idx) => {
                const inputVal = counts[p.id] ?? ''
                const parsed = parseInt(inputVal, 10)
                const isChanged =
                  inputVal !== '' && !isNaN(parsed) && parsed !== p.stock_qty
                const isLower =
                  inputVal !== '' && !isNaN(parsed) && parsed >= 0 && parsed < p.stock_qty
                const needsReason = isLower && !reasons[p.id]

                return (
                  <div
                    key={p.id}
                    className={`px-4 py-3 ${
                      idx !== products.length - 1 ? 'border-b border-gray-100' : ''
                    } ${isChanged ? 'bg-brand-light' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      {/* product info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate text-sm">{p.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.barcode}</p>
                      </div>

                      {/* current qty */}
                      <span
                        className={`w-14 text-right text-sm mr-1 shrink-0 ${
                          p.stock_qty <= 5 ? 'text-red-500 font-semibold' : 'text-gray-400'
                        }`}
                      >
                        {p.stock_qty}
                      </span>

                      {/* count input */}
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        placeholder="—"
                        value={inputVal}
                        onChange={(e) => handleCount(p.id, e.target.value)}
                        aria-label={t('stock_take_input_label', { name: p.name })}
                        className={`w-16 text-center border rounded-xl py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand ${
                          needsReason
                            ? 'border-red-400 text-red-600 bg-white'
                            : isChanged
                            ? 'border-brand text-brand-hover bg-white'
                            : 'border-gray-200 text-gray-900'
                        }`}
                      />
                    </div>

                    {/* Reason picker — shown only when the count is lower than
                        current stock. Required before saving (see handleSubmit). */}
                    {isLower && (
                      <div className="mt-2.5">
                        <p className="text-xs font-medium text-gray-500 mb-1.5">
                          {t('reason_prompt')}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {STOCK_TAKE_LOSS_REASONS.map((code) => {
                            const selected = reasons[p.id] === code
                            return (
                              <button
                                key={code}
                                type="button"
                                onClick={() => setReason(p.id, code)}
                                className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                                  selected
                                    ? 'bg-brand text-white border-brand'
                                    : 'bg-white text-gray-600 border-gray-200 active:bg-gray-50'
                                }`}
                              >
                                {t(`reason_${code}`)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </form>
        )}
      </main>

      {/* sticky submit bar — sits above the BottomNav (~64px tall + safe-area) */}
      {!isLoading && products.length > 0 && (
        <div
          className="fixed inset-x-0 bg-white border-t border-gray-200 z-30"
          style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto px-4 py-3">
            <button
              type="submit"
              form="stock-take-form"
              disabled={isSubmitting || countedItems === 0}
              className="w-full bg-brand text-white font-semibold py-4 rounded-full active:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? t('stock_take_btn_saving')
                : countedItems === 0
                  ? t('stock_take_btn_empty')
                  : tPlural('stock_take_btn_save', countedItems, { count: countedItems })}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
