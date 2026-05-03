/**
 * Phase 37c — dashboard companion to ComplianceCard.
 *
 * Renders X of Y journey steps done + next-step CTA. Owners only — the
 * dashboard already gates by role. Returns null if the slim journey query
 * couldn't resolve a shop (e.g. brand-new account mid-onboarding).
 *
 * Linked to /compliance/journey via the whole-card click target.
 */

import Link from 'next/link'
import { getJourneyProgressSummary } from '@/lib/db/journey'
import { getServerTranslations } from '@/lib/i18n/server'
import type { SupportedLocale } from '@/lib/i18n/types'

interface Props {
  shopId: string
  userId: string
  locale: SupportedLocale
}

export async function JourneyProgressCard({ shopId, userId, locale }: Props) {
  try {
    const { steps, ownerProfile, shop } = await getJourneyProgressSummary(shopId, userId)
    if (!shop || steps.length === 0) return null

    const completed = steps.filter((s) => s.status === 'complete').length
    const total = steps.length
    const pct = Math.round((completed / total) * 100)
    const allDone = completed === total

    const next =
      steps.find((s) => s.status === 'in_progress') ??
      steps.find((s) => s.status === 'not_started') ??
      steps.find((s) => s.status === 'locked') ??
      null

    const showFundTeaser =
      ownerProfile?.nationality_type === 'sa_citizen' &&
      shop.fund_interest &&
      !allDone

    const { t } = await getServerTranslations(locale, ['dashboard', 'compliance-journey'])

    return (
      <Link
        href="/compliance/journey"
        className="block bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm active:bg-gray-50"
      >
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-sm font-bold text-gray-900">
            {t('journey_card_title')}
          </p>
          <p className="text-xs text-gray-500">
            {t('journey_card_count', { completed, total })}
          </p>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full ${allDone ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {allDone ? (
          <p className="text-sm text-green-700 font-medium">
            {t('journey_card_all_done')}
          </p>
        ) : next ? (
          <p className="text-sm text-gray-700">
            <span className="text-gray-500">{t('journey_card_next_label')} </span>
            <span className="font-semibold">{t(`step_${next.key}_title`)}</span>
            <span className="text-blue-600 ml-1">{t('journey_card_continue_arrow')}</span>
          </p>
        ) : null}
        {showFundTeaser && (
          <p className="text-xs text-amber-700 mt-2">
            💰 {t('journey_card_fund_teaser')}
          </p>
        )}
      </Link>
    )
  } catch {
    return null
  }
}
