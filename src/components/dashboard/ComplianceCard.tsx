import { createClient } from '@/lib/supabase/server'
import { getComplianceScore } from '@/lib/db/compliance-score'
import { getTodayChecklist, todaySAST } from '@/lib/db/daily-checklist'
import { listBusinessDocuments } from '@/lib/db/business-documents'
import { computeDocumentStatus } from '@/lib/compliance/document-status'
import { getServerTranslations } from '@/lib/i18n/server'
import type { SupportedLocale } from '@/lib/i18n/types'

const BAND_STYLES = {
  green: {
    wrap: 'bg-green-50 border border-green-200 active:bg-green-100',
    ring: 'text-green-600',
    track: 'text-green-100',
    scoreText: 'text-green-700',
    title: 'text-green-900',
    body: 'text-green-700',
    arrow: 'text-green-400',
    bullet: 'bg-green-400',
  },
  amber: {
    wrap: 'bg-amber-50 border border-amber-200 active:bg-amber-100',
    ring: 'text-amber-500',
    track: 'text-amber-100',
    scoreText: 'text-amber-700',
    title: 'text-amber-900',
    body: 'text-amber-700',
    arrow: 'text-amber-400',
    bullet: 'bg-amber-500',
  },
  red: {
    wrap: 'bg-red-50 border border-red-200 active:bg-red-100',
    ring: 'text-red-600',
    track: 'text-red-100',
    scoreText: 'text-red-700',
    title: 'text-red-900',
    body: 'text-red-700',
    arrow: 'text-red-400',
    bullet: 'bg-red-500',
  },
} as const

const MAX_VISIBLE_ALERTS = 3

export async function ComplianceCard({
  shopId,
  locale,
}: {
  shopId: string
  locale: SupportedLocale
}) {
  try {
    const today = todaySAST()

    const supabase = await createClient()
    const [{ inputs, result }, todayChecklist, docs, { t, tPlural }] = await Promise.all([
      getComplianceScore(supabase, shopId),
      getTodayChecklist(shopId, today),
      listBusinessDocuments(),
      getServerTranslations(locale, ['dashboard']),
    ])

    const docSummary = computeDocumentStatus(docs, today)
    const docAttentionCount =
      docSummary.expiringSoon.length +
      docSummary.expired.length +
      docSummary.missing.length +
      docs.filter((d) => d.status === 'pending' || d.status === 'not_registered').length

    // Build alert list — order matters (most actionable first).
    const alerts: { key: string; href: string; label: string }[] = []
    if (!todayChecklist) {
      alerts.push({
        key: 'checklist',
        href: '/checklist',
        label: t('compliance_action_checklist'),
      })
    }
    if (docAttentionCount > 0) {
      alerts.push({
        key: 'documents',
        href: '/documents',
        label: tPlural('compliance_action_documents', docAttentionCount, {
          count: docAttentionCount,
        }),
      })
    }
    if (inputs.pestOverdue) {
      alerts.push({
        key: 'pest',
        href: '/waste-pest/pest/new',
        label: t('compliance_action_pest'),
      })
    }
    if (inputs.wasteStale) {
      alerts.push({
        key: 'waste',
        href: '/waste-pest/waste',
        label: t('compliance_action_waste'),
      })
    }

    const tone = BAND_STYLES[result.band]
    const radius = 28
    const circumference = 2 * Math.PI * radius
    const dash = (result.overall / 100) * circumference

    const hasAlerts = alerts.length > 0
    const visible = alerts.slice(0, MAX_VISIBLE_ALERTS)
    const overflow = Math.max(0, alerts.length - MAX_VISIBLE_ALERTS)

    return (
      <a
        href="/inspection"
        className={`flex items-start gap-3 rounded-2xl px-4 py-3 mb-4 ${tone.wrap}`}
      >
        {/* Score ring */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
            <circle
              cx="34"
              cy="34"
              r={radius}
              strokeWidth="6"
              fill="none"
              className={tone.track}
              stroke="currentColor"
            />
            <circle
              cx="34"
              cy="34"
              r={radius}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              className={tone.ring}
              stroke="currentColor"
              strokeDasharray={`${dash} ${circumference}`}
            />
          </svg>
          <span className={`absolute text-base font-bold ${tone.scoreText}`}>
            {result.overall}
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 pt-0.5">
          {hasAlerts ? (
            <>
              <p className={`text-sm font-bold ${tone.title}`}>
                {t('compliance_action_title')}
              </p>
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
              <p className={`text-sm font-bold ${tone.title}`}>
                {t('compliance_clear_title')}
              </p>
              <p className={`text-xs mt-0.5 ${tone.body}`}>{t('compliance_clear_hint')}</p>
            </>
          )}
        </div>

        <span className={`${tone.arrow} text-lg shrink-0 self-center`}>&rsaquo;</span>
      </a>
    )
  } catch {
    return null
  }
}
