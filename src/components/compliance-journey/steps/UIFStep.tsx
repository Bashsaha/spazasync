/**
 * Phase 37c — Step 5: UIF Registration (only rendered when has_employees=true).
 *
 * One-shot variant — the registration is online and immediate. We're not
 * tracking individual UIF reference numbers in this phase.
 */

import { MarkAsDoneButtons } from '../MarkAsDoneButtons'
import type { ComplianceJourneyStep } from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  step: ComplianceJourneyStep
  t: T
}

export function UIFStep({ step, t }: Props) {
  return (
    <>
      <section className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm">
        <h4 className="font-semibold text-gray-800 mb-2">{t('uif_what_header')}</h4>
        <p className="text-gray-700 mb-2">{t('uif_what_body')}</p>
        <p className="text-xs text-gray-500">{t('uif_cost')}</p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">
          {t('uif_how_header')}
        </h4>
        <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1.5">
          <li>{t('uif_how_step_1')}</li>
          <li>{t('uif_how_step_2')}</li>
          <li>{t('uif_how_step_3')}</li>
          <li>{t('uif_how_step_4')}</li>
        </ol>
        <a
          href="https://www.ufiling.co.za"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-blue-600 active:text-blue-800 underline text-sm font-semibold"
        >
          {t('uif_open_portal')} →
        </a>
      </section>

      <MarkAsDoneButtons step={step} variant="standard" />
    </>
  )
}
