/**
 * Phase 37e — Fund Readiness hero badge.
 *
 * Server component. Reads the localised title + description from the
 * compliance-fund namespace via the t() passed in by the page.
 */

import { CheckCircle2, AlertCircle, XCircle, type LucideIcon } from 'lucide-react'
import type { FundReadinessStatus } from '@/lib/compliance/fund'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  status: FundReadinessStatus
  missingCount: number
  t: T
}

const STYLES: Record<FundReadinessStatus, { bg: string; border: string; text: string; icon: LucideIcon; iconColor: string }> = {
  green: {
    bg: 'bg-brand-light',
    border: 'border-brand-light',
    text: 'text-brand-hover',
    icon: CheckCircle2,
    iconColor: 'text-green-600',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    icon: AlertCircle,
    iconColor: 'text-amber-600',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-900',
    icon: XCircle,
    iconColor: 'text-red-600',
  },
}

export function FundHeroStatus({ status, missingCount, t }: Props) {
  const s = STYLES[status]
  const Icon = s.icon
  return (
    <section
      className={`${s.bg} ${s.border} ${s.text} border rounded-2xl p-5 mb-4`}
    >
      <p className="flex items-center gap-1.5 text-sm font-semibold mb-1">
        <Icon className={`w-4 h-4 ${s.iconColor}`} strokeWidth={2} />
        {t(`status_${status}_title`)}
      </p>
      <p className="text-sm leading-snug">
        {t(`status_${status}_desc`, { count: missingCount })}
      </p>
    </section>
  )
}
