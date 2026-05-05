/**
 * Phase 37c — Step 3: CIPC business registration.
 *
 * One-shot online process via bizportal.gov.za — no separate "applied" /
 * "received" workflow makes sense here, so the action row is variant='standard'
 * (so owners who DO want to track the wait between submission and approval
 * still can).
 */

import { FormSummaryCard, type FormSummaryRow } from '../FormSummaryCard'
import { MarkAsDoneButtons } from '../MarkAsDoneButtons'
import { generateGoodsDescription } from '@/lib/compliance/goods-description'
import type {
  ComplianceJourneyData,
  ComplianceJourneyStep,
} from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  step: ComplianceJourneyStep
  data: ComplianceJourneyData
  t: T
}

export function CIPCStep({ step, data, t }: Props) {
  const showFundCallout = data.shop.fund_interest

  const formRows: FormSummaryRow[] = [
    { labelKey: 'form_full_name', value: null, missing: 'fill_at_office' },
    { labelKey: 'form_id_number', value: null, missing: 'fill_at_office' },
    { labelKey: 'form_phone', value: data.shop.whatsapp_number, missing: 'add_in_settings' },
    { labelKey: 'form_email', value: data.ownerEmail, missing: 'unknown' },
    { labelKey: 'cipc_business_address', value: data.shop.location, missing: 'add_in_settings' },
    {
      labelKey: 'cipc_business_description',
      value: generateGoodsDescription(data.productNames),
    },
  ]

  return (
    <>
      <section className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm">
        <h4 className="font-semibold text-gray-800 mb-2">{t('cipc_need_header')}</h4>
        <p className="text-gray-700 mb-2">{t('cipc_need_required_intro')}</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1 mb-3">
          <li>{t('cipc_need_required_a')}</li>
          <li>{t('cipc_need_required_b')}</li>
          <li>{t('cipc_need_required_c')}</li>
        </ul>
        <p className="text-gray-700 mb-1">{t('cipc_need_optional_intro')}</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1 mb-3">
          <li>{t('cipc_need_optional_a')}</li>
        </ul>
        <p className="text-xs text-gray-500">{t('cipc_cost')}</p>
        {showFundCallout && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            💰 {t('cipc_fund_callout')}
          </p>
        )}
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">
          {t('cipc_how_header')}
        </h4>
        <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1.5">
          <li>{t('cipc_how_step_1')}</li>
          <li>{t('cipc_how_step_2')}</li>
          <li>{t('cipc_how_step_3')}</li>
          <li>{t('cipc_how_step_4')}</li>
          <li>{t('cipc_how_step_5')}</li>
          <li>{t('cipc_how_step_6')}</li>
          <li>{t('cipc_how_step_7')}</li>
        </ol>
        <a
          href="https://www.bizportal.gov.za"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-blue-600 active:text-blue-800 underline text-sm font-semibold"
        >
          {t('cipc_open_portal')} →
        </a>
      </section>

      <FormSummaryCard rows={formRows} t={t} headerKey="cipc_form_header" />

      <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
        ℹ️ {t('cipc_annual_return_note')}
      </p>

      <MarkAsDoneButtons step={step} variant="standard" />
    </>
  )
}
