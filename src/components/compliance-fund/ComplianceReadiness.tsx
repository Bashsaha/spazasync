/**
 * Phase 37e — Compliance score summary on the Fund page.
 *
 * Server component. Shows the same 0–100 score the dashboard uses, plus
 * the per-category breakdown so the owner sees what's pulling them below
 * the GREEN floor (≥80) the fund expects.
 */

import { Check, AlertTriangle } from 'lucide-react'
import type { ComplianceScoreResult } from '@/types'
import { FUND_GREEN_SCORE_MIN } from '@/lib/compliance/fund'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  result: ComplianceScoreResult
  t: T
}

export function ComplianceReadiness({ result, t }: Props) {
  const ok = result.overall >= FUND_GREEN_SCORE_MIN
  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-5 mb-4 ">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">
        {t('compliance_header')}
      </h2>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm text-gray-700">{t('compliance_score_label')}</p>
        <p className={`flex items-center gap-1.5 text-lg font-bold ${ok ? 'text-brand-hover' : 'text-amber-700'}`}>
          {result.overall}/100
          {ok ? (
            <Check className="w-5 h-5 text-green-600" strokeWidth={2.25} />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600" strokeWidth={1.75} />
          )}
        </p>
      </div>
      <ul className="text-xs text-gray-600 space-y-1">
        {result.categories.map((cat) => (
          <li key={cat.key} className="flex items-center justify-between">
            <span>{t(`compliance_cat_${cat.key}`)}</span>
            <span className={`inline-flex items-center gap-1 ${cat.score === 100 ? 'text-brand-hover' : 'text-gray-700'}`}>
              {cat.score === 100 ? (
                <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={2.25} />
              ) : (
                `${cat.score}%`
              )}
            </span>
          </li>
        ))}
      </ul>
      {!ok && (
        <p className="text-xs text-amber-700 mt-3">
          {t('compliance_below_floor', { min: FUND_GREEN_SCORE_MIN })}
        </p>
      )}
    </section>
  )
}
