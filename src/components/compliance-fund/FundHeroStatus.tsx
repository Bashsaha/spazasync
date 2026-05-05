/**
 * Phase 37e — Fund Readiness hero badge.
 *
 * Server component. Reads the localised title + description from the
 * compliance-fund namespace via the t() passed in by the page.
 */

import type { FundReadinessStatus } from '@/lib/compliance/fund'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  status: FundReadinessStatus
  missingCount: number
  t: T
}

const STYLES: Record<FundReadinessStatus, { bg: string; border: string; text: string; icon: string }> = {
  green: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    icon: '🟢',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    icon: '🟡',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-900',
    icon: '🔴',
  },
}

export function FundHeroStatus({ status, missingCount, t }: Props) {
  const s = STYLES[status]
  return (
    <section
      className={`${s.bg} ${s.border} ${s.text} border rounded-2xl p-5 mb-4`}
    >
      <p className="text-sm font-semibold mb-1">
        {s.icon} {t(`status_${status}_title`)}
      </p>
      <p className="text-sm leading-snug">
        {t(`status_${status}_desc`, { count: missingCount })}
      </p>
    </section>
  )
}
