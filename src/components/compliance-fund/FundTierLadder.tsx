/**
 * Phase 41b — Visual tier ladder for the R500M Spaza Shop Support Fund.
 *
 * Replaces the previous text-heavy Tier 1 / Tier 2 split. Per the SEFA / SAnews
 * guideline the actual gating threshold is R80,000 — CIPC registration is
 * required for ANY funding above R80k, regardless of category. The previous
 * UI implied R100k. This component makes the threshold visually unmissable:
 * a single horizontal bar split into three zones (R0–R80k → no CIPC; R80k–R300k
 * → CIPC required; >R300k → unavailable) with the owner's current position
 * marked.
 *
 * Pure presentation, server component.
 */

import { Lock, CircleCheck } from 'lucide-react'
import { FUND_CIPC_UNLOCK_AMOUNT_ZAR } from '@/lib/compliance/fund'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  cipcRegistered: boolean
  t: T
}

const FUND_MAX_ZAR = 300_000

export function FundTierLadder({ cipcRegistered, t }: Props) {
  // Each zone's width is proportional to its rand range, capped at FUND_MAX_ZAR
  // for the "above R300k" sliver. Zone widths: 80/220/sliver in a 100% bar.
  const belowPct = (FUND_CIPC_UNLOCK_AMOUNT_ZAR / FUND_MAX_ZAR) * 100  // ~26.7%
  const abovePct = 100 - belowPct                                       // ~73.3%

  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">
        {t('tier_ladder_header')}
      </h2>

      {/* Bar */}
      <div className="relative w-full h-9 rounded-full overflow-hidden flex border border-gray-200">
        <div
          className={`flex items-center justify-center ${cipcRegistered ? 'bg-brand-light text-brand-hover' : 'bg-brand text-white'}`}
          style={{ width: `${belowPct}%` }}
        >
          <span className="text-[10px] font-bold whitespace-nowrap px-1">
            ≤ R80k
          </span>
        </div>
        <div
          className={`flex items-center justify-center ${cipcRegistered ? 'bg-brand text-white' : 'bg-gray-200 text-gray-500'}`}
          style={{ width: `${abovePct}%` }}
        >
          <span className="text-[10px] font-bold whitespace-nowrap px-1 flex items-center gap-1">
            {!cipcRegistered && <Lock className="w-3 h-3" strokeWidth={2.5} />}
            R80k – R300k
          </span>
        </div>
      </div>

      {/* Threshold tick label */}
      <div className="relative mt-1.5 mb-3 h-3" aria-hidden="true">
        <div
          className="absolute -translate-x-1/2 text-[9px] font-semibold text-gray-500"
          style={{ left: `${belowPct}%` }}
        >
          ↑ R80,000
        </div>
      </div>

      {/* Zone descriptions */}
      <div className="space-y-2 text-xs">
        <div className="flex items-start gap-2">
          <CircleCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" strokeWidth={2} />
          <div>
            <p className="font-bold text-gray-900">{t('tier_ladder_below_label')}</p>
            <p className="text-gray-600">{t('tier_ladder_below_hint')}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          {cipcRegistered ? (
            <CircleCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" strokeWidth={2} />
          ) : (
            <Lock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" strokeWidth={2} />
          )}
          <div>
            <p className={`font-bold ${cipcRegistered ? 'text-gray-900' : 'text-gray-500'}`}>
              {t('tier_ladder_above_label')}
            </p>
            <p className="text-gray-600">{t('tier_ladder_above_hint')}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Lock className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" strokeWidth={2} />
          <div>
            <p className="font-bold text-gray-400">{t('tier_ladder_cap_label')}</p>
            <p className="text-gray-400">{t('tier_ladder_cap_hint')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
