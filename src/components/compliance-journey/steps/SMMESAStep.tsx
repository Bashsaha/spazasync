/**
 * Phase 37c — Step 7: SMMESA Registration.
 *
 * Only shown to SA citizens with fund_interest=true. Simple online flow —
 * one-shot variant. Saves the SMMESA reference number on "I've received".
 */

import { MarkAsDoneButtons } from '../MarkAsDoneButtons'
import type { ComplianceJourneyStep } from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  step: ComplianceJourneyStep
  t: T
}

export function SMMESAStep({ step, t }: Props) {
  return (
    <>
      <section className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm">
        <h4 className="font-semibold text-gray-800 mb-2">{t('smmesa_what_header')}</h4>
        <p className="text-gray-700">{t('smmesa_what_body')}</p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">
          {t('smmesa_how_header')}
        </h4>
        <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1.5">
          <li>{t('smmesa_how_step_1')}</li>
          <li>{t('smmesa_how_step_2')}</li>
          <li>{t('smmesa_how_step_3')}</li>
        </ol>
        <a
          href="https://www.smmesa.gov.za"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-blue-600 active:text-blue-800 underline text-sm font-semibold"
        >
          {t('smmesa_open_portal')} →
        </a>
      </section>

      <MarkAsDoneButtons step={step} variant="standard" />
    </>
  )
}
