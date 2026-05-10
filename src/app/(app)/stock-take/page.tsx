'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check } from 'lucide-react'
import type { Product } from '@/types'
import { useTranslation } from '@/components/LanguageProvider'
import { FullScreenSpinner } from '@/components/Spinner'
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible'
import { emitDataChanged } from '@/lib/events'

export default function StockTakePage() {
  const router = useRouter()
  const { t, tPlural } = useTranslation('stock')
  const [products, setProducts] = useState<Product[]>([])
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [errorRaw, setErrorRaw] = useState('')
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [profitTrackingEnabled, setProfitTrackingEnabled] = useState(false)
  const [productsMissingCost, setProductsMissingCost] = useState(0)

  const loadStockTake = useCallback(() => {
    Promise.all([
      fetch('/api/products', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/settings', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
    ])
      .then(([productsData, settingsData]) => {
        setProducts((productsData.products ?? productsData) as Product[])
        if (settingsData) {
          setProfitTrackingEnabled(Boolean(settingsData.profit_tracking_enabled))
          setProductsMissingCost(settingsData.products_missing_cost ?? 0)
        }
        setErrorKey(null)
      })
      .catch(() => setErrorKey('stock_take_error_load'))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    loadStockTake()
  }, [loadStockTake])

  useRefetchOnVisible(loadStockTake)

  const countedItems = Object.values(counts).filter((v) => v !== '').length

  function handleCount(productId: string, value: string) {
    setCounts((prev) => ({ ...prev, [productId]: value }))
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

    const entries = products
      .filter((p) => counts[p.id] !== undefined && counts[p.id] !== '')
      .map((p) => ({
        product_id: p.id,
        qty_after: parseInt(counts[p.id], 10),
      }))
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
          onClick={() => router.push('/dashboard')}
          className="w-full max-w-xs bg-brand text-white font-semibold py-4 rounded-full active:bg-brand-hover"
        >
          {t('stock_take_btn_dashboard')}
        </button>
        <button
          onClick={() => {
            setCounts({})
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
      <main className="px-4 pt-8 pb-32 max-w-lg mx-auto">
        {/* header */}
        <div className="flex items-center gap-3 mb-1">
          <Link href="/dashboard" className="text-gray-400 text-sm active:text-gray-600">
            {t('back')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('stock_take_title')}</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6 ml-11">
          {t('stock_take_subtitle')}
        </p>

        {/* Missing cost price alert */}
        {!isLoading && profitTrackingEnabled && productsMissingCost > 0 && (
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

                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 px-4 py-3 ${
                      idx !== products.length - 1 ? 'border-b border-gray-100' : ''
                    } ${isChanged ? 'bg-brand-light' : ''}`}
                  >
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
                        isChanged
                          ? 'border-brand text-brand-hover bg-white'
                          : 'border-gray-200 text-gray-900'
                      }`}
                    />
                  </div>
                )
              })}
            </div>
          </form>
        )}
      </main>

      {/* sticky submit bar */}
      {!isLoading && products.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 ">
          <div className="max-w-lg mx-auto px-4 py-3">
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
