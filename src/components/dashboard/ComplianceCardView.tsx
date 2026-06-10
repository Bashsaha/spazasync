'use client'

import Link from 'next/link'
import { useTranslation } from '@/components/LanguageProvider'

/**
 * Presentational compliance card (Phase 44 App Shell — dashboard is now client
 * cache-first). Takes the band/score + typed alert descriptors from
 * /api/dashboard and renders them; no data fetching here.
 */

const BAND_STYLES = {
  green: {
    wrap: 'bg-green-50 border border-green-200 active:bg-green-100',
    ring: 'text-green-600', track: 'text-green-100', scoreText: 'text-green-700',
    title: 'text-green-900', body: 'text-green-700', arrow: 'text-green-400', bullet: 'bg-green-400',
  },
  amber: {
    wrap: 'bg-amber-50 border border-amber-200 active:bg-amber-100',
    ring: 'text-amber-500', track: 'text-amber-100', scoreText: 'text-amber-700',
    title: 'text-amber-900', body: 'text-amber-700', arrow: 'text-amber-400', bullet: 'bg-amber-500',
  },
  red: {
    wrap: 'bg-red-50 border border-red-200 active:bg-red-100',
    ring: 'text-red-600', track: 'text-red-100', scoreText: 'text-red-700',
    title: 'text-red-900', body: 'text-red-700', arrow: 'text-red-400', bullet: 'bg-red-500',
  },
} as const

const MAX_VISIBLE_ALERTS = 3

const ALERT_HREF: Record<string, string> = {
  checklist: '/checklist',
  documents: '/documents',
  pest: '/waste-pest/pest/new',
  waste: '/waste-pest/waste',
}

export type ComplianceCardData = {
  band: keyof typeof BAND_STYLES
  overall: number
  alerts: { type: 'checklist' | 'documents' | 'pest' | 'waste'; count?: number }[]
}

export function ComplianceCardView({ data }: { data: ComplianceCardData }) {
  const { t, tPlural } = useTranslation('dashboard')

  const tone = BAND_STYLES[data.band] ?? BAND_STYLES.amber
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const dash = (data.overall / 100) * circumference

  const labelled = data.alerts.map((a) => ({
    key: a.type,
    href: ALERT_HREF[a.type],
    label:
      a.type === 'documents'
        ? tPlural('compliance_action_documents', a.count ?? 0, { count: a.count ?? 0 })
        : t(`compliance_action_${a.type}`),
  }))
  const hasAlerts = labelled.length > 0
  const visible = labelled.slice(0, MAX_VISIBLE_ALERTS)
  const overflow = Math.max(0, labelled.length - MAX_VISIBLE_ALERTS)

  return (
    <Link href="/inspection" data-tour="compliance-card" className={`flex items-start gap-3 rounded-2xl px-4 py-3 mb-4 ${tone.wrap}`}>
      <div className="relative flex items-center justify-center shrink-0">
        <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
          <circle cx="34" cy="34" r={radius} strokeWidth="6" fill="none" className={tone.track} stroke="currentColor" />
          <circle
            cx="34" cy="34" r={radius} strokeWidth="6" fill="none" strokeLinecap="round"
            className={tone.ring} stroke="currentColor" strokeDasharray={`${dash} ${circumference}`}
          />
        </svg>
        <span className={`absolute text-base font-bold ${tone.scoreText}`}>{data.overall}</span>
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        {hasAlerts ? (
          <>
            <p className={`text-sm font-bold ${tone.title}`}>{t('compliance_action_title')}</p>
            <ul className={`text-xs mt-1 space-y-1 ${tone.body}`}>
              {visible.map((a) => (
                <li key={a.key} className="flex items-start gap-1.5">
                  <span className={`${tone.bullet} w-1 h-1 rounded-full mt-1.5 shrink-0`} />
                  <span className="leading-snug">{a.label}</span>
                </li>
              ))}
              {overflow > 0 && (
                <li className="text-xs opacity-75">
                  {tPlural('compliance_action_more', overflow, { count: overflow })}
                </li>
              )}
            </ul>
          </>
        ) : (
          <>
            <p className={`text-sm font-bold ${tone.title}`}>{t('compliance_clear_title')}</p>
            <p className={`text-xs mt-0.5 ${tone.body}`}>{t('compliance_clear_hint')}</p>
          </>
        )}
      </div>

      <span className={`${tone.arrow} text-lg shrink-0 self-center`}>&rsaquo;</span>
    </Link>
  )
}
