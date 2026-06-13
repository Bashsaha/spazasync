/**
 * Phase 50 — "Your route to qualifying" hero.
 *
 * The page's single dominant element. Carries the core message — you qualify
 * for the fund by finishing your compliance steps — and makes it visual:
 * a progress meter over the fund-required registrations, the green/amber/red
 * verdict badge, a compliance-score chip, and ONE primary CTA into the
 * compliance journey.
 *
 * Absorbs the old FundHeroStatus (verdict) + ComplianceReadiness (score) so
 * the page no longer repeats those as standalone cards. Server component.
 */

import { CheckCircle2, AlertCircle, XCircle, ArrowRight, type LucideIcon } from 'lucide-react'
import { Card, Badge, LinkButton, ProgressMeter, type BadgeTone } from '@/components/ui'
import { FUND_GREEN_SCORE_MIN, type FundReadinessDocRow, type FundReadinessStatus } from '@/lib/compliance/fund'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  status: FundReadinessStatus
  missingCount: number
  requiredDocs: FundReadinessDocRow[]
  complianceScore: number
  t: T
}

const STATUS_META: Record<FundReadinessStatus, { tone: BadgeTone; icon: LucideIcon; iconColor: string; bar: 'green' | 'brand' | 'amber' }> = {
  green: { tone: 'green', icon: CheckCircle2, iconColor: 'text-green-600', bar: 'green' },
  amber: { tone: 'amber', icon: AlertCircle, iconColor: 'text-amber-600', bar: 'amber' },
  red: { tone: 'red', icon: XCircle, iconColor: 'text-red-600', bar: 'amber' },
}

export function FundQualifyHero({ status, missingCount, requiredDocs, complianceScore, t }: Props) {
  const ready = requiredDocs.filter((r) => r.ok).length
  const total = requiredDocs.length
  const meta = STATUS_META[status]
  const Icon = meta.icon
  const scoreOk = complianceScore >= FUND_GREEN_SCORE_MIN

  return (
    <Card padding="lg" className="border-brand-light bg-brand-light/40 mb-4">
      <h2 className="text-base font-bold text-gray-900">{t('hero_title')}</h2>
      <p className="text-sm text-gray-700 mt-1 leading-snug">{t('hero_anchor')}</p>

      <div className="mt-4">
        <ProgressMeter
          value={ready}
          max={total}
          tone={meta.bar}
          label={t('hero_progress_label')}
          valueLabel={t('hero_progress_count', { ready, total })}
        />
      </div>

      <div className="flex items-center gap-2 mt-3">
        <Badge tone={meta.tone}>
          <Icon className={`w-3.5 h-3.5 mr-1 ${meta.iconColor}`} strokeWidth={2.25} />
          {t(`status_${status}_badge`)}
        </Badge>
        <Badge tone={scoreOk ? 'green' : 'amber'}>
          {t('hero_score_chip', { score: complianceScore })}
        </Badge>
      </div>

      <p className="text-sm font-semibold text-gray-900 mt-3">
        {t(`status_${status}_title`, { count: missingCount })}
      </p>
      <p className="text-sm text-gray-700 mt-0.5 leading-snug">
        {t(`status_${status}_desc`, { count: missingCount })}
      </p>

      <LinkButton
        href="/compliance/journey"
        variant="primary"
        size="lg"
        fullWidth
        icon={ArrowRight}
        iconPosition="right"
        className="mt-4"
      >
        {t(status === 'green' ? 'hero_cta_done' : 'hero_cta')}
      </LinkButton>
    </Card>
  )
}
