/**
 * Phase 37c — Step 4: SARS Tax Registration.
 *
 * Uses the last-30-day revenue from `data.monthlyRevenueZar` to render a
 * personalised "tax situation" panel — most spaza shops qualify for Turnover
 * Tax (under R1 million / year), so the copy switches based on whether we've
 * seen revenue at all.
 */

import { MarkAsDoneButtons } from '../MarkAsDoneButtons'
import type {
  ComplianceJourneyData,
  ComplianceJourneyStep,
} from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  step: ComplianceJourneyStep
  data: ComplianceJourneyData
  t: T
  /** Swap "ID number" copy for "passport / asylum-seeker number". */
  isForeignNational?: boolean
}

function formatZar(amount: number): string {
  return amount.toLocaleString('en-ZA', { maximumFractionDigits: 0 })
}

export function SARSStep({ step, data, t, isForeignNational = false }: Props) {
  const monthly = data.monthlyRevenueZar
  const annual = monthly * 12

  return (
    <>
      <section className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm">
        <h4 className="font-semibold text-gray-800 mb-2">
          {t('sars_situation_header')}
        </h4>
        {monthly > 0 ? (
          <>
            <p className="text-gray-700 mb-1">
              {t('sars_monthly_sales')} <strong>R{formatZar(monthly)}</strong>
            </p>
            <p className="text-gray-700 mb-3">
              {t('sars_estimated_annual')} <strong>R{formatZar(annual)}</strong>
            </p>
          </>
        ) : (
          <p className="text-gray-600 mb-3">{t('sars_no_data_yet')}</p>
        )}
        {annual < 2_300_000 ? (
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-green-800">
            <p className="font-semibold mb-1">{t('sars_qualify_turnover_title')}</p>
            <p className="text-sm">{t('sars_qualify_turnover_body')}</p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-amber-800">
            <p className="font-semibold mb-1">{t('sars_above_threshold_title')}</p>
            <p className="text-sm">{t('sars_above_threshold_body')}</p>
          </div>
        )}
        <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mt-3">
          💰 {t('sars_tax_free_band_note')}
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">
          {t('sars_how_header')}
        </h4>
        <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1.5">
          <li>{t('sars_how_step_1')}</li>
          <li>{t('sars_how_step_2')}</li>
          <li>{t(isForeignNational ? 'sars_how_step_3_foreign' : 'sars_how_step_3')}</li>
          <li>{t('sars_how_step_4')}</li>
          <li>{t('sars_how_step_5')}</li>
          <li>{t('sars_how_step_6')}</li>
        </ol>
        {isForeignNational && (
          <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mt-3">
            ℹ️ {t('sars_foreign_note')}
          </p>
        )}
        <a
          href="https://www.sarsefiling.co.za"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-brand active:text-brand-hover underline text-sm font-semibold"
        >
          {t('sars_open_efiling')} →
        </a>
      </section>

      <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
        ℹ️ {t('sars_tax_clearance_note')}
      </p>

      <MarkAsDoneButtons step={step} variant="standard" />
    </>
  )
}
