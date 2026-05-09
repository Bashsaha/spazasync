'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { SaleWithDetails, DailySalesTotals } from '@/types'
import { formatZAR } from '@/lib/utils/currency'
import { formatSAST } from '@/lib/utils/date'
import { useTranslation } from '@/components/LanguageProvider'
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible'

interface ByDateResponse {
  sales: SaleWithDetails[]
  totals: DailySalesTotals
  profit_tracking_enabled: boolean
}

/** Current date in SAST as YYYY-MM-DD. SAST is always UTC+2 (no DST). */
function todaySAST(): string {
  const now = new Date()
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  return sast.toISOString().slice(0, 10)
}

function shiftDate(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

function SalesHistoryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, tPlural, locale } = useTranslation('sales')

  const today = todaySAST()
  const dateParam = searchParams.get('date')
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today

  const [data, setData] = useState<ByDateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const loadSales = useCallback(() => {
    setLoading(true)
    fetch(`/api/sales/by-date?date=${date}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('load')
        return r.json() as Promise<ByDateResponse>
      })
      .then((d) => {
        setData(d)
        setErrorKey(null)
      })
      .catch(() => setErrorKey('error_load'))
      .finally(() => setLoading(false))
  }, [date])

  useEffect(() => {
    loadSales()
    setExpanded(new Set())
  }, [loadSales])

  useRefetchOnVisible(loadSales)

  function navigateToDate(ymd: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('date', ymd)
    router.push(`/sales/history?${params.toString()}`)
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const yesterday = shiftDate(today, -1)
  const localeTag = locale === 'en' ? 'en-ZA' : locale
  const dateLabel = (() => {
    if (date === today) return t('today')
    if (date === yesterday) return t('yesterday')
    try {
      return new Date(date + 'T00:00:00').toLocaleDateString(localeTag, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return date
    }
  })()

  // Month derived from the currently-viewed date (so the button labels match what you're looking at).
  const [viewedYear, viewedMonth] = date.split('-').map((n) => parseInt(n, 10))
  const prevMonthDate = new Date(Date.UTC(viewedYear, viewedMonth - 2, 1))
  const prevYear = prevMonthDate.getUTCFullYear()
  const prevMonth = prevMonthDate.getUTCMonth() + 1
  const pdfUrl = (y: number, m: number) => `/api/reports/monthly-sales-pdf?year=${y}&month=${m}`

  const profitTrackingOn = Boolean(data?.profit_tracking_enabled)
  const totals = data?.totals
  const sales = data?.sales ?? []

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/sales" className="text-gray-400 active:text-gray-600 text-sm">
          {t('back')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t('history_title')}</h1>
      </div>

      {/* Date picker row */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 ">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {t('pick_date')}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigateToDate(shiftDate(date, -1))}
            className="text-sm font-semibold text-brand active:text-brand-hover px-2 py-2 shrink-0"
          >
            {t('prev_day')}
          </button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => navigateToDate(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            aria-label={t('pick_date')}
          />
          <button
            type="button"
            onClick={() => navigateToDate(shiftDate(date, 1))}
            disabled={date === today}
            className="text-sm font-semibold text-brand active:text-brand-hover px-2 py-2 shrink-0 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            {t('next_day')}
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-3 font-semibold">{dateLabel}</p>
      </div>

      {/* Totals strip */}
      {!loading && !errorKey && totals && (
        <div className={`grid ${profitTrackingOn ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mb-5`}>
          <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center ">
            <p className="text-xl font-bold text-gray-900">{totals.saleCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {tPlural('totals_sales', totals.saleCount, { count: totals.saleCount })}
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center ">
            <p className="text-xl font-bold text-gray-900">{formatZAR(totals.revenue)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('totals_revenue')}</p>
          </div>
          {profitTrackingOn && (
            <div
              className={`rounded-2xl p-3 text-center border ${
                totals.profit !== null ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
              }`}
            >
              <p
                className={`text-xl font-bold ${
                  totals.profit !== null ? 'text-green-700' : 'text-amber-700'
                }`}
              >
                {totals.profit !== null ? formatZAR(totals.profit) : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{t('totals_profit')}</p>
            </div>
          )}
        </div>
      )}

      {profitTrackingOn && totals && totals.profit === null && totals.saleCount > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
          {t('profit_unavailable')}
        </p>
      )}

      {/* Monthly PDF downloads — full-page reload is fine, browser will trigger download */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5 ">
        <p className="text-sm font-semibold text-gray-900">{t('download_pdf_title')}</p>
        <p className="text-xs text-gray-500 mt-0.5">{t('download_pdf_desc')}</p>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <a
            href={pdfUrl(viewedYear, viewedMonth)}
            className="flex-1 text-center bg-brand text-white text-sm font-semibold py-2.5 rounded-full active:bg-brand-hover"
          >
            {t('download_pdf_this_month')}
          </a>
          <a
            href={pdfUrl(prevYear, prevMonth)}
            className="flex-1 text-center bg-white border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 rounded-xl active:bg-gray-50"
          >
            {t('download_pdf_prev_month')}
          </a>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <p className="text-center text-gray-400 text-sm mt-8">{t('loading')}</p>
      )}

      {/* Error */}
      {errorKey && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4 mb-4">{t(errorKey)}</div>
      )}

      {/* Empty */}
      {!loading && !errorKey && sales.length === 0 && (
        <div className="text-center mt-10">
          <p className="text-gray-500 text-sm font-semibold">{t('no_sales')}</p>
          <p className="text-gray-400 text-xs mt-1">{t('no_sales_hint')}</p>
        </div>
      )}

      {/* Sales list */}
      {!loading && !errorKey && sales.length > 0 && (
        <ul className="space-y-2">
          {sales.map((sale) => {
            const isOpen = expanded.has(sale.id)
            return (
              <li key={sale.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(sale.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between p-4 text-left active:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {formatZAR(sale.total)}
                      {profitTrackingOn && sale.profit !== null && (
                        <span className="ml-2 text-xs font-semibold text-green-700">
                          +{formatZAR(sale.profit)}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatSAST(sale.completed_at, 'HH:mm')}
                      {' · '}
                      <span className={sale.teller_name ? '' : 'italic text-gray-400'}>
                        {sale.teller_name ?? t('sale_no_teller')}
                      </span>
                    </p>
                  </div>
                  <span className="text-gray-300 text-sm ml-2">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {t('items_title')}
                    </p>
                    <ul className="divide-y divide-gray-50">
                      {sale.items.map((item) => (
                        <li key={item.id} className="py-2 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-gray-900">
                                <span className="font-semibold text-gray-500">
                                  {tPlural('item_qty', item.quantity, { count: item.quantity })}
                                </span>{' '}
                                {item.product_name}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {t('item_unit_price')}: {formatZAR(item.unit_price)}
                                {item.unit_cost !== null && (
                                  <>
                                    {' · '}
                                    {t('item_unit_cost')}: {formatZAR(item.unit_cost)}
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-gray-900">{formatZAR(item.subtotal)}</p>
                              {item.line_profit !== null && profitTrackingOn && (
                                <p className="text-xs text-green-700 mt-0.5">
                                  +{formatZAR(item.line_profit)}
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

export default function SalesHistoryPage() {
  return (
    <Suspense
      fallback={
        <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
          <p className="text-center text-gray-400 text-sm mt-12">Loading…</p>
        </main>
      }
    >
      <SalesHistoryContent />
    </Suspense>
  )
}
