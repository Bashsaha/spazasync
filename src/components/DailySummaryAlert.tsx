'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DailySummaryData, LowStockItem, ExpiringProductAlert } from '@/types'
import { useTranslation } from '@/components/LanguageProvider'

interface SummaryResponse {
  sales: DailySummaryData
  lowStock: LowStockItem[]
  expiring: ExpiringProductAlert[]
  profitTrackingEnabled: boolean
}

const LS_KEY = 'last_summary_seen'
const TRIGGER_HOUR = 21 // 9pm SAST
const CHECK_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

function getSASTHour(): number {
  // SAST is UTC+2, always (no daylight saving)
  const now = new Date()
  const utcHour = now.getUTCHours()
  return (utcHour + 2) % 24
}

function getTodaySAST(): string {
  const now = new Date()
  // Offset to SAST (+2h) and get the date string
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  return sast.toISOString().slice(0, 10)
}

function shouldShowBanner(): boolean {
  const hour = getSASTHour()
  if (hour < TRIGGER_HOUR) return false
  const today = getTodaySAST()
  const lastSeen = localStorage.getItem(LS_KEY)
  return lastSeen !== today
}

function formatRand(amount: number): string {
  return `R${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

export default function DailySummaryAlert() {
  const { t, tPlural } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SummaryResponse | null>(null)

  const checkTime = useCallback(() => {
    if (shouldShowBanner()) setVisible(true)
  }, [])

  useEffect(() => {
    checkTime()
    const interval = setInterval(checkTime, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [checkTime])

  async function handleView() {
    setLoading(true)
    try {
      const res = await fetch('/api/summary/daily')
      if (res.ok) {
        const json: SummaryResponse = await res.json()
        setData(json)
        setShowModal(true)
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false)
    }
    // Mark as seen
    localStorage.setItem(LS_KEY, getTodaySAST())
    setVisible(false)
  }

  function handleDismiss() {
    localStorage.setItem(LS_KEY, getTodaySAST())
    setVisible(false)
  }

  function handleCloseModal() {
    setShowModal(false)
  }

  // Banner
  if (visible && !showModal) {
    return (
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between gap-3 animate-slide-down">
        <p className="text-sm font-medium flex-1">
          {t('banner_text')}
        </p>
        <button
          onClick={handleView}
          disabled={loading}
          className="bg-white text-blue-600 text-sm font-semibold px-4 py-1.5 rounded-lg shrink-0 disabled:opacity-50"
        >
          {loading ? t('btn_loading') : t('btn_view')}
        </button>
        <button
          onClick={handleDismiss}
          className="text-blue-200 text-lg leading-none shrink-0"
          aria-label={t('dismiss')}
        >
          ✕
        </button>
      </div>
    )
  }

  // Modal
  if (showModal && data) {
    const { sales, lowStock, expiring, profitTrackingEnabled } = data
    const hasExpiring = expiring.some((e) => e.expiring_soon_qty > 0)
    const hasExpired = expiring.some((e) => e.expired_qty > 0)

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto shadow-xl">
          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{t('modal_title')}</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 text-xl leading-none"
                aria-label={t('close')}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Sales */}
            {sales.salesCount > 0 ? (
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-green-800 font-semibold text-base">
                  {tPlural('sales_text', sales.salesCount, {
                    amount: formatRand(sales.totalRevenue),
                    count: sales.salesCount,
                  })}
                </p>
                {profitTrackingEnabled && sales.hasProfitData && (
                  <p className="text-green-700 text-sm font-medium mt-1">
                    {t('profit_text', { amount: formatRand(sales.totalProfit) })}
                  </p>
                )}
                {sales.topItems.length > 0 && (
                  <div className="mt-2">
                    <p className="text-green-700 text-sm font-medium">{t('top_sellers')}</p>
                    <ul className="mt-1 space-y-0.5">
                      {sales.topItems.slice(0, 3).map((item) => (
                        <li key={item.name} className="text-green-600 text-sm">
                          {t('sold', { name: item.name, count: item.totalQty })}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-700 font-semibold">{t('no_sales')}</p>
                <p className="text-gray-500 text-sm mt-1">
                  {t('no_sales_encourage')}
                </p>
              </div>
            )}

            {/* Low stock */}
            {lowStock.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-amber-800 font-semibold text-sm">
                  {tPlural('low_stock', lowStock.length, { count: lowStock.length })}
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {lowStock.slice(0, 5).map((item) => (
                    <li key={item.name} className="text-amber-700 text-sm">
                      {t('low_stock_item', { name: item.name, count: item.stock_qty })}
                    </li>
                  ))}
                  {lowStock.length > 5 && (
                    <li className="text-amber-600 text-xs mt-1">
                      {t('low_stock_more', { count: lowStock.length - 5 })}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Expiring */}
            {(hasExpiring || hasExpired) && (
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-red-800 font-semibold text-sm">{t('expiring_title')}</p>
                <ul className="mt-1.5 space-y-0.5">
                  {expiring
                    .filter((e) => e.expired_qty > 0 || e.expiring_soon_qty > 0)
                    .slice(0, 5)
                    .map((item) => (
                      <li key={item.name} className="text-red-700 text-sm">
                        {item.expired_qty > 0
                          ? t('expiring_item_expired', { name: item.name, count: item.expired_qty })
                          : t('expiring_item_soon', { name: item.name, count: item.expiring_soon_qty })}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5">
            <button
              onClick={handleCloseModal}
              className="w-full bg-blue-600 text-white font-semibold rounded-xl py-3 text-sm active:bg-blue-700"
            >
              {t('btn_close')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
