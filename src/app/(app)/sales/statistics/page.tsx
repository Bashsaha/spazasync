'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, TrendingUp, TrendingDown, Coins, PackageX } from 'lucide-react'
import { formatZAR } from '@/lib/utils/currency'
import { BackButton } from '@/components/BackButton'
import { useTranslation } from '@/components/LanguageProvider'
import { PdfDownloadButton } from '@/components/PdfDownloadButton'
import { WeeklySalesChart } from '@/components/dashboard/WeeklySalesChart'
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible'
import type { SalesStatistics, ProductMovement, NonMover } from '@/lib/db/sales-statistics'

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

export default function SalesStatisticsPage() {
  const { t, tPlural } = useTranslation('sales-statistics')

  const today = todaySAST()
  // Default range: last 30 days (inclusive of today).
  const [from, setFrom] = useState<string>(shiftDate(today, -29))
  const [to, setTo] = useState<string>(today)
  const [data, setData] = useState<SalesStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorKey, setErrorKey] = useState<string | null>(null)

  const loadStats = useCallback(() => {
    setLoading(true)
    fetch(`/api/sales/statistics?from=${from}&to=${to}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('load')
        return r.json() as Promise<SalesStatistics>
      })
      .then((d) => {
        setData(d)
        setErrorKey(null)
      })
      .catch(() => setErrorKey('error_load'))
      .finally(() => setLoading(false))
  }, [from, to])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useRefetchOnVisible(loadStats)

  const pdfUrl = useMemo(
    () => `/api/reports/sales-statistics-pdf?from=${from}&to=${to}`,
    [from, to],
  )

  const totals = data?.totals
  const profitOn = Boolean(totals?.profit_tracking_enabled)
  const hasAnyData = Boolean(data && data.totals.sales_count > 0)

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <BackButton fallbackHref="/sales" />
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      </div>
      <p className="text-gray-500 text-sm mb-5 ml-12">{t('subtitle')}</p>

      {/* Date range card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t('pick_range')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="stats-from" className="block text-xs font-medium text-gray-500 mb-1">
              {t('from_label')}
            </label>
            <input
              id="stats-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label htmlFor="stats-to" className="block text-xs font-medium text-gray-500 mb-1">
              {t('to_label')}
            </label>
            <input
              id="stats-to"
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && <p className="text-center text-gray-400 text-sm mt-6">{t('loading')}</p>}

      {/* Error */}
      {errorKey && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4 mb-4">{t(errorKey)}</div>
      )}

      {!loading && !errorKey && data && totals && (
        <>
          {/* Summary tiles */}
          <div className={`grid ${profitOn ? 'grid-cols-2' : 'grid-cols-3'} gap-2 mb-4`}>
            <SummaryTile label={t('summary_sales')} value={String(totals.sales_count)} />
            <SummaryTile label={t('summary_units')} value={String(totals.units_sold)} />
            <SummaryTile label={t('summary_revenue')} value={formatZAR(totals.revenue)} />
            <SummaryTile label={t('summary_avg')} value={formatZAR(totals.avg_sale_value)} />
            {profitOn && totals.profit !== null && (
              <SummaryTile
                label={t('summary_profit')}
                value={formatZAR(totals.profit)}
                tone={totals.profit >= 0 ? 'green' : 'red'}
                wide
              />
            )}
          </div>

          {/* Revenue trend chart */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">{t('trend_title')}</p>
              <span className="text-xs font-medium text-gray-400">
                {data.granularity === 'daily' ? t('trend_daily') : t('trend_weekly')}
              </span>
            </div>
            <WeeklySalesChart
              data={data.trend}
              labels={{
                noData: t('trend_no_data'),
                saleOne: t('trend_sale_one'),
                saleOther: t('trend_sale_other'),
              }}
            />
          </div>

          {/* Top sellers */}
          <MovementSection
            icon={<TrendingUp className="w-4 h-4 text-brand" strokeWidth={2.25} />}
            title={t('top_title')}
            subtitle={t('top_subtitle')}
            rows={data.top_sellers}
            metric="units"
            tPlural={tPlural}
            emptyText={t('list_empty_sales')}
          />

          {/* Lowest sellers */}
          <MovementSection
            icon={<TrendingDown className="w-4 h-4 text-amber-500" strokeWidth={2.25} />}
            title={t('lowest_title')}
            subtitle={t('lowest_subtitle')}
            rows={data.lowest_sellers}
            metric="units"
            tPlural={tPlural}
            emptyText={t('list_empty_sales')}
          />

          {/* Most profitable (profit tracking only) */}
          {profitOn && (
            <MovementSection
              icon={<Coins className="w-4 h-4 text-green-600" strokeWidth={2.25} />}
              title={t('profit_title')}
              subtitle={t('profit_subtitle')}
              rows={data.top_profit}
              metric="profit"
              tPlural={tPlural}
              emptyText={t('profit_empty')}
            >
              {totals.products_missing_cost > 0 && (
                <Link
                  href="/products/missing-cost"
                  className="block bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 active:bg-amber-100"
                >
                  <p className="text-xs font-semibold text-amber-800">
                    {tPlural('profit_missing_cost', totals.products_missing_cost, {
                      count: totals.products_missing_cost,
                    })}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">{t('profit_missing_cost_link')}</p>
                </Link>
              )}
            </MovementSection>
          )}

          {/* Non-movers */}
          <NonMoversSection
            title={t('nonmovers_title')}
            subtitle={t('nonmovers_subtitle')}
            rows={data.non_movers}
            emptyText={t('nonmovers_empty')}
            tPlural={tPlural}
          />

          {/* Download PDF */}
          <PdfDownloadButton
            href={pdfUrl}
            fallbackFilename={`sales-statistics-${from}-to-${to}.pdf`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-full text-sm font-semibold mt-2 bg-brand text-white active:bg-brand-hover disabled:opacity-70 disabled:cursor-wait"
          >
            <Download className="w-4 h-4" />
            {t('download_pdf')}
          </PdfDownloadButton>

          <p className="text-xs text-gray-400 text-center mt-5">{t('footer_note')}</p>

          {!hasAnyData && <span className="sr-only">{t('trend_no_data')}</span>}
        </>
      )}
    </main>
  )
}

function SummaryTile({
  label,
  value,
  tone,
  wide,
}: {
  label: string
  value: string
  tone?: 'green' | 'red'
  wide?: boolean
}) {
  const valueClass =
    tone === 'green' ? 'text-green-700' : tone === 'red' ? 'text-red-600' : 'text-gray-900'
  return (
    <div
      className={`bg-white border border-gray-100 rounded-2xl p-3 text-center ${wide ? 'col-span-2' : ''}`}
    >
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

function MovementSection({
  icon,
  title,
  subtitle,
  rows,
  metric,
  tPlural,
  emptyText,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  rows: ProductMovement[]
  metric: 'units' | 'profit'
  tPlural: (key: string, count: number, params?: Record<string, string | number>) => string
  emptyText: string
  children?: React.ReactNode
}) {
  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-0.5">
        {icon}
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>
      <p className="text-xs text-gray-400 mb-3 ml-6">{subtitle}</p>
      {children}
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">{emptyText}</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.product_id} className="flex items-center gap-3">
              <span className="w-5 text-xs font-bold text-gray-400 text-right shrink-0">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                <p className="text-xs text-gray-400">
                  {tPlural('units_sold', r.units_sold, { count: r.units_sold })}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-900 shrink-0">
                {metric === 'profit'
                  ? formatZAR(r.profit ?? 0)
                  : formatZAR(r.revenue)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function NonMoversSection({
  title,
  subtitle,
  rows,
  emptyText,
  tPlural,
}: {
  title: string
  subtitle: string
  rows: NonMover[]
  emptyText: string
  tPlural: (key: string, count: number, params?: Record<string, string | number>) => string
}) {
  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-0.5">
        <PackageX className="w-4 h-4 text-gray-500" strokeWidth={2.25} />
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>
      <p className="text-xs text-gray-400 mb-3 ml-6">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li key={n.product_id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{n.name}</p>
                <p className="text-xs text-gray-400">
                  {tPlural('in_stock', n.stock_qty, { count: n.stock_qty })}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-900 shrink-0">{formatZAR(n.price)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
