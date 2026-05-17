/**
 * Phase 41d — visualise the SARS 6-month grace window for the owner.
 *
 * The window itself was wired into the fund engine in Phase 41a
 * (`shops.sars_grace_period_until` + `computeFundReadiness`'s `sarsGraceActive`
 * branch), but until now the owner had no way to see how much time was left.
 * If SARS is the only missing doc, the fund readiness moves to GREEN once
 * SARS is registered — but the owner had no visible deadline to plan around.
 *
 * Renders only when:
 *   1. `sars_grace_period_until` is set on the shop, AND
 *   2. SARS is currently being treated as "ok" via the grace branch
 *      (`fundReadiness.sarsInGracePeriod === true`).
 *
 * Server component, pure presentation. Day-precision math is enough — the
 * owner needs "about 4 months left" granularity, not minutes.
 */

import { CalendarClock } from 'lucide-react'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  sarsGracePeriodUntil: string | null   // YYYY-MM-DD
  sarsInGracePeriod: boolean
  t: T
}

function daysUntil(yyyyMmDd: string): number {
  const target = Date.parse(`${yyyyMmDd}T00:00:00Z`)
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.round((target - today) / (24 * 60 * 60 * 1000))
}

export function SarsGraceCountdown({
  sarsGracePeriodUntil,
  sarsInGracePeriod,
  t,
}: Props) {
  if (!sarsInGracePeriod || !sarsGracePeriodUntil) return null

  const days = daysUntil(sarsGracePeriodUntil)
  // Engine already treats grace as expired when the date is past, so days<0
  // shouldn't get here — but defence in depth.
  if (days < 0) return null

  // Pick urgency colour based on remaining time. Mirrors the document-expiry
  // bucket rules in reminders.ts: ≤30d urgent, ≤60d warning, otherwise info.
  const tone =
    days <= 30
      ? { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-800', icon: 'text-red-700' }
      : days <= 60
      ? { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800', icon: 'text-amber-700' }
      : { border: 'border-brand-light', bg: 'bg-brand-light/40', text: 'text-brand-hover', icon: 'text-brand' }

  return (
    <section className={`rounded-2xl border ${tone.border} ${tone.bg} p-4 mb-4`}>
      <div className="flex items-start gap-2.5">
        <CalendarClock className={`w-5 h-5 ${tone.icon} shrink-0 mt-0.5`} strokeWidth={1.75} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-bold ${tone.text}`}>
            {t('sars_grace_countdown_title', { days })}
          </h3>
          <p className={`text-xs ${tone.text} mt-1 opacity-90`}>
            {t('sars_grace_countdown_body', { date: sarsGracePeriodUntil })}
          </p>
        </div>
      </div>
    </section>
  )
}
