/**
 * Phase 41d — visualise the SARS 6-month grace window for the owner.
 * Phase 50 — ported to the <Callout> primitive (was a hand-rolled banner).
 *
 * Renders only when:
 *   1. `sars_grace_period_until` is set on the shop, AND
 *   2. SARS is currently being treated as "ok" via the grace branch
 *      (`fundReadiness.sarsInGracePeriod === true`).
 *
 * Urgency tone mirrors the document-expiry buckets in reminders.ts:
 * ≤30d error, ≤60d warning, otherwise brand. Server component.
 */

import { CalendarClock } from 'lucide-react'
import { Callout, type CalloutTone } from '@/components/ui'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  sarsGracePeriodUntil: string | null // YYYY-MM-DD
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

  const tone: CalloutTone = days <= 30 ? 'error' : days <= 60 ? 'warning' : 'brand'

  return (
    <Callout
      tone={tone}
      icon={CalendarClock}
      title={t('sars_grace_countdown_title', { days })}
      className="mb-4"
    >
      {t('sars_grace_countdown_body', { date: sarsGracePeriodUntil })}
    </Callout>
  )
}
