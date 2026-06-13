/**
 * Phase 50 — "What you could receive" (merged).
 *
 * Combines the old FundTierLadder (the R80k threshold bar) + FundBreakdown
 * (the Tier 1 / Tier 2 line items) into one section, since both explained the
 * funding tiers and reading as two separate cards felt repetitive. Renders as
 * bare content — the page wraps it in a <Disclosure>. Server component, pure
 * presentation.
 */

import { Lock, CircleCheck, Lightbulb } from 'lucide-react'
import { Callout } from '@/components/ui'
import { FUND_CIPC_UNLOCK_AMOUNT_ZAR } from '@/lib/compliance/fund'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  cipcRegistered: boolean
  t: T
}

const FUND_MAX_ZAR = 300_000

export function FundReceiveSection({ cipcRegistered, t }: Props) {
  const belowPct = (FUND_CIPC_UNLOCK_AMOUNT_ZAR / FUND_MAX_ZAR) * 100 // ~26.7%
  const abovePct = 100 - belowPct // ~73.3%

  return (
    <div>
      {/* Threshold bar */}
      <p className="text-sm font-semibold text-gray-900 mb-3">
        {t('tier_ladder_header')}
      </p>
      <div className="relative w-full h-9 rounded-full overflow-hidden flex border border-gray-200">
        <div
          className={`flex items-center justify-center ${cipcRegistered ? 'bg-brand-light text-brand-dark' : 'bg-brand text-white'}`}
          style={{ width: `${belowPct}%` }}
        >
          <span className="text-[10px] font-bold whitespace-nowrap px-1">≤ R80k</span>
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
      <div className="relative mt-1.5 mb-3 h-3" aria-hidden="true">
        <div
          className="absolute -translate-x-1/2 text-[9px] font-semibold text-gray-500"
          style={{ left: `${belowPct}%` }}
        >
          ↑ R80,000
        </div>
      </div>

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

      {/* Line-item breakdown */}
      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="text-sm font-bold text-gray-900 mb-2">{t('tier1_title')}</p>
        <ul className="text-xs text-gray-700 space-y-2">
          <li>
            <p className="font-semibold">{t('tier1_stock_title')}</p>
            <p className="text-gray-500">{t('tier1_stock_desc')}</p>
          </li>
          <li>
            <p className="font-semibold">{t('tier1_infra_title')}</p>
            <p className="text-gray-500">{t('tier1_infra_desc')}</p>
          </li>
          <li>
            <p className="font-semibold">{t('tier1_training_title')}</p>
            <p className="text-gray-500">{t('tier1_training_desc')}</p>
          </li>
        </ul>
        {!cipcRegistered && (
          <Callout tone="warning" icon={Lightbulb} className="mt-3">
            {t('tier1_cipc_unlock_hint')}
          </Callout>
        )}
      </div>

      {cipcRegistered && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm font-bold text-brand-dark mb-2">{t('tier2_title')}</p>
          <p className="text-xs text-gray-700 mb-2">{t('tier2_intro')}</p>
          <ul className="text-xs text-gray-700 space-y-2">
            <li>
              <p className="font-semibold">{t('tier2_blended_title')}</p>
              <p className="text-gray-500">{t('tier2_blended_desc')}</p>
            </li>
            <li>
              <p className="font-semibold">{t('tier2_training_title')}</p>
              <p className="text-gray-500">{t('tier2_training_desc')}</p>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
