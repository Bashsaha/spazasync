'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DailySummaryData, LowStockItem, ExpiringProductAlert } from '@/types'

interface SummaryResponse {
  sales: DailySummaryData
  lowStock: LowStockItem[]
  expiring: ExpiringProductAlert[]
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
          Your daily summary is ready
        </p>
        <button
          onClick={handleView}
          disabled={loading}
          className="bg-white text-blue-600 text-sm font-semibold px-4 py-1.5 rounded-lg shrink-0 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'View'}
        </button>
        <button
          onClick={handleDismiss}
          className="text-blue-200 text-lg leading-none shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    )
  }

  // Modal
  if (showModal && data) {
    const { sales, lowStock, expiring } = data
    const hasExpiring = expiring.some((e) => e.expiring_soon_qty > 0)
    const hasExpired = expiring.some((e) => e.expired_qty > 0)

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto shadow-xl">
          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Today&apos;s Summary</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 text-xl leading-none"
                aria-label="Close"
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
                  You made {formatRand(sales.totalRevenue)} from {sales.salesCount} sale{sales.salesCount !== 1 ? 's' : ''} today
                </p>
                {sales.topItems.length > 0 && (
                  <div className="mt-2">
                    <p className="text-green-700 text-sm font-medium">Top sellers:</p>
                    <ul className="mt-1 space-y-0.5">
                      {sales.topItems.slice(0, 3).map((item) => (
                        <li key={item.name} className="text-green-600 text-sm">
                          {item.name} — {item.totalQty} sold
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-700 font-semibold">No sales today</p>
                <p className="text-gray-500 text-sm mt-1">
                  Tomorrow is a new day — you&apos;ve got this!
                </p>
              </div>
            )}

            {/* Low stock */}
            {lowStock.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-amber-800 font-semibold text-sm">
                  Stock running low ({lowStock.length} product{lowStock.length !== 1 ? 's' : ''})
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {lowStock.slice(0, 5).map((item) => (
                    <li key={item.name} className="text-amber-700 text-sm">
                      {item.name} — {item.stock_qty} left
                    </li>
                  ))}
                  {lowStock.length > 5 && (
                    <li className="text-amber-600 text-xs mt-1">
                      …and {lowStock.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Expiring */}
            {(hasExpiring || hasExpired) && (
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-red-800 font-semibold text-sm">Products expiring soon</p>
                <ul className="mt-1.5 space-y-0.5">
                  {expiring
                    .filter((e) => e.expired_qty > 0 || e.expiring_soon_qty > 0)
                    .slice(0, 5)
                    .map((item) => (
                      <li key={item.name} className="text-red-700 text-sm">
                        {item.name}
                        {item.expired_qty > 0 && ` — ${item.expired_qty} expired`}
                        {item.expiring_soon_qty > 0 && ` — ${item.expiring_soon_qty} expiring soon`}
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
              Got it
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
