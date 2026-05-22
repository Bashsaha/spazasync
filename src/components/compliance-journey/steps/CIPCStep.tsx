/**
 * Phase 37c — Step 3: CIPC business registration.
 *
 * SA citizens use BizPortal self-service (SA ID login). Foreign nationals
 * CANNOT use BizPortal's ID flow — they register through CIPC eServices
 * (eservices.cipc.co.za) with a certified passport, and CIPC runs a manual
 * "Foreigner Assurance" identity check. The how-to copy, the portal link, and
 * the form header all swap on `isForeignNational` so we never send a foreign
 * owner to a dead end (verified 2026-05-21 — see compliance-facts-audit.md §C).
 */

import { Wallet } from 'lucide-react'
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
  /** Phase 37f — swap "ID number" copy for "passport number". */
  isForeignNational?: boolean
}

export function CIPCStep({ step, data, t, isForeignNational = false }: Props) {
  const showFundCallout = data.shop.fund_interest

  const formRows: FormSummaryRow[] = [
    { labelKey: 'form_full_name', value: null, missing: 'fill_at_office' },
    {
      labelKey: isForeignNational ? 'form_passport_number' : 'form_id_number',
      value: null,
      missing: 'fill_at_office',
    },
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
          {/* The citizen first-reason is "apply for government funding" — foreign
              nationals are excluded from the fund, so they get a fund-free reason. */}
          <li>{t(isForeignNational ? 'cipc_need_required_a_foreign' : 'cipc_need_required_a')}</li>
          <li>{t('cipc_need_required_b')}</li>
          <li>{t('cipc_need_required_c')}</li>
        </ul>
        <p className="text-gray-700 mb-1">{t('cipc_need_optional_intro')}</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1 mb-3">
          <li>{t('cipc_need_optional_a')}</li>
        </ul>
        <p className="text-xs text-gray-500">{t('cipc_cost')}</p>
        {showFundCallout && (
          <p className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-3">
            <Wallet className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={1.75} />
            <span>{t('cipc_fund_callout')}</span>
          </p>
        )}
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">
          {t('cipc_how_header')}
        </h4>
        <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1.5">
          <li>{t(isForeignNational ? 'cipc_how_step_1_foreign' : 'cipc_how_step_1')}</li>
          <li>{t('cipc_how_step_2')}</li>
          <li>{t(isForeignNational ? 'cipc_how_step_3_foreign' : 'cipc_how_step_3')}</li>
          <li>{t('cipc_how_step_4')}</li>
          <li>{t('cipc_how_step_5')}</li>
          <li>{t('cipc_how_step_6')}</li>
          <li>{t('cipc_how_step_7')}</li>
        </ol>
        {isForeignNational && (
          <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mt-3">
            ℹ️ {t('cipc_foreign_note')}
          </p>
        )}
        <a
          href={isForeignNational ? 'https://eservices.cipc.co.za' : 'https://www.bizportal.gov.za'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-brand active:text-brand-hover underline text-sm font-semibold"
        >
          {t(isForeignNational ? 'cipc_open_portal_foreign' : 'cipc_open_portal')} →
        </a>
      </section>

      <FormSummaryCard
        rows={formRows}
        t={t}
        headerKey={isForeignNational ? 'cipc_form_header_foreign' : 'cipc_form_header'}
      />

      <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
        ℹ️ {t('cipc_annual_return_note')}
      </p>

      <MarkAsDoneButtons step={step} variant="standard" />
    </>
  )
}
