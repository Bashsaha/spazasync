'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import type { ComplianceScoreResult } from '@/types'

interface ScoreResponse {
  result: ComplianceScoreResult
}

const LS_PREFIX = 'mvs_monthly_alert_last_shown_'
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

/** SAST-local YYYY-MM key for the current month. */
function getSASTMonth(): string {
  const now = new Date()
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  return `${sast.getUTCFullYear()}_${String(sast.getUTCMonth() + 1).padStart(2, '0')}`
}

function shouldShowBanner(): boolean {
  if (typeof window === 'undefined') return false
  const month = getSASTMonth()
  const lastSeen = localStorage.getItem(LS_PREFIX + month)
  return !lastSeen
}

const BAND_TONE: Record<'green' | 'amber' | 'red', { score: string; ring: string; track: string }> = {
  green: { score: 'text-green-700', ring: 'text-green-600', track: 'text-green-100' },
  amber: { score: 'text-amber-700', ring: 'text-amber-500', track: 'text-amber-100' },
  red: { score: 'text-red-700', ring: 'text-red-600', track: 'text-red-100' },
}

export default function MonthlyComplianceAlert() {
  const { t } = useTranslation('inspection')
  const [visible, setVisible] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ComplianceScoreResult | null>(null)

  const checkTime = useCallback(() => {
    if (shouldShowBanner()) setVisible(true)
  }, [])

  useEffect(() => {
    checkTime()
    const interval = setInterval(checkTime, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [checkTime])

  function markSeen() {
    try {
      localStorage.setItem(LS_PREFIX + getSASTMonth(), '1')
    } catch {
      /* localStorage unavailable — ignore */
    }
  }

  async function handleView() {
    setLoading(true)
    try {
      const res = await fetch('/api/compliance-score')
      if (res.ok) {
        const json: ScoreResponse = await res.json()
        setData(json.result)
        setShowModal(true)
      }
    } catch {
      /* swallow — user can retry */
    } finally {
      setLoading(false)
    }
    markSeen()
    setVisible(false)
  }

  function handleDismiss() {
    markSeen()
    setVisible(false)
  }

  function handleCloseModal() {
    setShowModal(false)
  }

  if (visible && !showModal) {
    return (
      <div className="bg-brand text-white px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium flex-1">{t('monthly_alert_title')}</p>
        <button
          onClick={handleView}
          disabled={loading}
          className="bg-white text-brand text-sm font-semibold px-4 py-1.5 rounded-lg shrink-0 disabled:opacity-50"
        >
          {loading ? t('loading') : t('monthly_cta_view')}
        </button>
        <button
          onClick={handleDismiss}
          className="text-brand-light text-lg leading-none shrink-0"
          aria-label={t('monthly_cta_dismiss')}
        >
          ✕
        </button>
      </div>
    )
  }

  if (showModal && data) {
    const tone = BAND_TONE[data.band]
    const radius = 36
    const circumference = 2 * Math.PI * radius
    const dash = (data.overall / 100) * circumference

    const tipKey =
      data.band === 'green' ? 'monthly_alert_tip_good' : 'monthly_alert_tip_improve'
    const tip = t(tipKey)

    const weakest = [...data.categories]
      .filter((c) => c.tipKey)
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden ">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">{t('monthly_alert_title')}</h2>
            <button
              onClick={handleCloseModal}
              className="text-gray-400 text-xl leading-none"
              aria-label={t('monthly_cta_dismiss')}
            >
              ✕
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center shrink-0">
                <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
                  <circle
                    cx="42"
                    cy="42"
                    r={radius}
                    strokeWidth="8"
                    fill="none"
                    className={tone.track}
                    stroke="currentColor"
                  />
                  <circle
                    cx="42"
                    cy="42"
                    r={radius}
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    className={tone.ring}
                    stroke="currentColor"
                    strokeDasharray={`${dash} ${circumference}`}
                  />
                </svg>
                <span className={`absolute text-lg font-bold ${tone.score}`}>
                  {data.overall}
                </span>
              </div>
              <p className="text-sm text-gray-700 flex-1">
                {t('monthly_alert_body', { score: data.overall, tip })}
              </p>
            </div>

            {weakest.length > 0 && (
              <ul className="space-y-1">
                {weakest.map((c) => (
                  <li key={c.key} className="text-xs text-gray-600">
                    • {t(`cat_${c.key}`)} — {t('breakdown_contribution', { score: c.score, weight: c.weight })}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="px-5 pb-5 flex flex-col gap-2">
            <a
              href="/inspection"
              onClick={handleCloseModal}
              className="block text-center bg-brand text-white font-semibold rounded-full py-3 text-sm active:bg-brand-hover"
            >
              {t('monthly_cta_view')}
            </a>
            <button
              onClick={handleCloseModal}
              className="text-gray-500 text-sm py-2"
            >
              {t('monthly_cta_dismiss')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
