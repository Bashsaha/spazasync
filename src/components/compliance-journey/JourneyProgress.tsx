/**
 * Phase 37c — header card for /compliance/journey.
 *
 * Shows: "X of Y steps done" + a progress bar + "Next: <step name>" CTA.
 * Server component — no interactivity here, just presentation.
 */

import type { ComplianceJourneyStep } from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  steps: ComplianceJourneyStep[]
  t: T
  /** Optional fund-teaser line shown when SA + fund_interest + steps_remaining > 0. */
  showFundTeaser?: boolean
}

export function JourneyProgress({ steps, t, showFundTeaser }: Props) {
  const completed = steps.filter((s) => s.status === 'complete').length
  const total = steps.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const allDone = completed === total

  // Pick the next step to highlight: in_progress > not_started > locked.
  const next =
    steps.find((s) => s.status === 'in_progress') ??
    steps.find((s) => s.status === 'not_started') ??
    steps.find((s) => s.status === 'locked') ??
    null

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700">
          {t('progress_header')}
        </h2>
        <p className="text-sm font-bold text-gray-900">
          {t('progress_count', { completed, total })}
        </p>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full ${allDone ? 'bg-green-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {allDone ? (
        <p className="text-sm text-green-700 font-medium">
          {t('progress_all_done')}
        </p>
      ) : next ? (
        <p className="text-sm text-gray-700">
          <span className="text-gray-500">{t('progress_next_label')} </span>
          <span className="font-semibold">{t(`step_${next.key}_title`)}</span>
        </p>
      ) : null}
      {showFundTeaser && !allDone && (
        <p className="text-xs text-amber-700 mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          💰 {t('progress_fund_teaser')}
        </p>
      )}
    </section>
  )
}
