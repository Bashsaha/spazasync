'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { formatZAR } from '@/lib/utils/currency'
import { formatSAST } from '@/lib/utils/date'
import { useTranslation } from '@/components/LanguageProvider'

interface StockLossRow {
  occurred_at: string
  product_id: string
  product_name: string
  qty_removed: number
  cost_price: number | null
  value_lost: number
  source: 'adjustment' | 'stock_take'
  reason: string | null
}

interface StockLossResponse {
  from: string
  to: string
  rows: StockLossRow[]
  totals: {
    total_items: number
    total_value: number
    rows_count: number
    rows_missing_cost: number
  }
}

function todaySAST(): string {
  const sast = new Date(Date.now() + 2 * 60 * 60 * 1000)
  return sast.toISOString().slice(0, 10)
}

function shiftDate(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

type Preset = '7d' | '30d' | '90d' | 'custom'

export default function StockLossPage() {
  const { t, tPlural } = useTranslation('stock-loss')

  const today = todaySAST()
  const [preset, setPreset] = useState<Preset>('30d')
  const [from, setFrom] = useState<string>(shiftDate(today, -29))
  const [to, setTo] = useState<string>(today)
  const [data, setData] = useState<StockLossResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorKey, setErrorKey] = useState<string | null>(null)

  function applyPreset(p: Preset) {
    setPreset(p)
    if (p === 'custom') return
    const days = p === '7d' ? 7 : p === '30d' ? 30 : 90
    setFrom(shiftDate(today, -(days - 1)))
    setTo(today)
  }

  const loadLoss = useCallback(() => {
    setLoading(true)
    fetch(`/api/stock-loss?from=${from}&to=${to}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('load')
        return r.json() as Promise<StockLossResponse>
      })
      .then((d) => {
        setData(d)
        setErrorKey(null)
      })
      .catch(() => setErrorKey('error_load'))
      .finally(() => setLoading(false))
  }, [from, to])

  useEffect(() => {
    loadLoss()
  }, [loadLoss])

  const pdfUrl = useMemo(
    () => `/api/reports/stock-loss-pdf?from=${from}&to=${to}`,
    [from, to],
  )

  const rows = data?.rows ?? []
  const totals = data?.totals

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link href="/stock-take" className="text-gray-400 text-sm active:text-gray-600">
          {t('back')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      </div>
      <p className="text-gray-500 text-sm mb-5 ml-11">{t('subtitle')}</p>

      {/* Date range card — presets (2×2 grid) + stacked date inputs */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t('pick_range')}
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {(['7d', '30d', '90d', 'custom'] as Preset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                preset === p
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white text-gray-700 border-gray-200 active:bg-gray-50'
              }`}
            >
              {t(`preset_${p}`)}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="loss-from"
              className="block text-xs font-medium text-gray-500 mb-1"
            >
              {t('from_label')}
            </label>
            <input
              id="loss-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                setFrom(e.target.value)
                setPreset('custom')
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label
              htmlFor="loss-to"
              className="block text-xs font-medium text-gray-500 mb-1"
            >
              {t('to_label')}
            </label>
            <input
              id="loss-to"
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => {
                setTo(e.target.value)
                setPreset('custom')
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>
      </div>

      {/* Summary tiles */}
      {!loading && !errorKey && totals && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-gray-900">{totals.total_items}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('total_items')}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-red-700">{formatZAR(totals.total_value)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('total_value')}</p>
          </div>
        </div>
      )}

      {/* Missing-cost nudge */}
      {!loading && totals && totals.rows_missing_cost > 0 && (
        <Link
          href="/products?missing_cost=1"
          className="block bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4 active:bg-amber-100"
        >
          <p className="text-xs font-semibold text-amber-800">
            {tPlural('missing_cost_note', totals.rows_missing_cost, {
              count: totals.rows_missing_cost,
              total: totals.rows_count,
            })}
          </p>
          <p className="text-xs text-amber-600 mt-0.5">{t('missing_cost_link')}</p>
        </Link>
      )}

      {/* Download PDF — disabled when no rows */}
      <a
        href={pdfUrl}
        aria-disabled={rows.length === 0}
        onClick={(e) => {
          if (rows.length === 0) e.preventDefault()
        }}
        className={`flex items-center justify-center gap-2 w-full py-3 rounded-full text-sm font-semibold mb-5 ${
          rows.length === 0
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-brand text-white active:bg-brand-hover'
        }`}
      >
        <Download className="w-4 h-4" />
        {t('download_pdf')}
      </a>

      {/* Loading */}
      {loading && <p className="text-center text-gray-400 text-sm mt-6">{t('loading')}</p>}

      {/* Error */}
      {errorKey && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4 mb-4">{t(errorKey)}</div>
      )}

      {/* Empty */}
      {!loading && !errorKey && rows.length === 0 && (
        <div className="text-center mt-8">
          <p className="text-gray-500 text-sm font-semibold">{t('empty_title')}</p>
          <p className="text-gray-400 text-xs mt-1">{t('empty_hint')}</p>
        </div>
      )}

      {/* Rows */}
      {!loading && !errorKey && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r, idx) => (
            <li
              key={`${r.product_id}-${r.occurred_at}-${idx}`}
              className="bg-white rounded-2xl border border-gray-100 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.product_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatSAST(r.occurred_at, 'dd MMM yyyy HH:mm')}
                    {' · '}
                    {t(r.source === 'adjustment' ? 'source_adjustment' : 'source_stock_take')}
                  </p>
                  {r.reason && (
                    <p className="text-xs text-gray-600 mt-1 italic">{r.reason}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-red-700">
                    −{r.qty_removed}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.cost_price !== null ? formatZAR(r.value_lost) : t('no_cost')}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-gray-400 text-center mt-6">{t('footer_note')}</p>
    </main>
  )
}
