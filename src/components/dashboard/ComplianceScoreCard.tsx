import { createClient } from '@/lib/supabase/server'
import { getComplianceScore } from '@/lib/db/compliance-score'
import { getServerTranslations } from '@/lib/i18n/server'
import type { SupportedLocale } from '@/lib/i18n/types'

const BAND_STYLES = {
  green: {
    wrap: 'bg-green-50 border border-green-200 active:bg-green-100',
    ring: 'text-green-600',
    track: 'text-green-100',
    scoreText: 'text-green-700',
    title: 'text-green-900',
    hint: 'text-green-700',
    arrow: 'text-green-400',
  },
  amber: {
    wrap: 'bg-amber-50 border border-amber-200 active:bg-amber-100',
    ring: 'text-amber-500',
    track: 'text-amber-100',
    scoreText: 'text-amber-700',
    title: 'text-amber-900',
    hint: 'text-amber-700',
    arrow: 'text-amber-400',
  },
  red: {
    wrap: 'bg-red-50 border border-red-200 active:bg-red-100',
    ring: 'text-red-600',
    track: 'text-red-100',
    scoreText: 'text-red-700',
    title: 'text-red-900',
    hint: 'text-red-700',
    arrow: 'text-red-400',
  },
} as const

export async function ComplianceScoreCard({
  shopId,
  locale,
}: {
  shopId: string
  locale: SupportedLocale
}) {
  try {
    const supabase = await createClient()
    const [{ result }, { t }] = await Promise.all([
      getComplianceScore(supabase, shopId),
      getServerTranslations(locale, ['dashboard']),
    ])

    const tone = BAND_STYLES[result.band]
    const radius = 28
    const circumference = 2 * Math.PI * radius
    const dash = (result.overall / 100) * circumference

    return (
      <a
        href="/inspection"
        className={`flex items-center justify-between rounded-2xl px-4 py-3 mb-4 ${tone.wrap}`}
      >
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
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
          <div>
            <p className={`text-sm font-bold ${tone.title}`}>{t('score_card_title')}</p>
            <p className={`text-xs mt-0.5 ${tone.hint}`}>{t('score_card_hint')}</p>
          </div>
        </div>
        <span className={`${tone.arrow} text-lg`}>&rsaquo;</span>
      </a>
    )
  } catch {
    return null
  }
}
