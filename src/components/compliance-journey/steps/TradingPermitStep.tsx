/**
 * Phase 37c — Step 1: Municipal Trading Permit.
 *
 * Server component. Renders four sections per the spec:
 *   A) "What you need to bring" — DocumentChecklist from municipality_requirements
 *   B) "Your form details"      — pre-filled FormSummaryCard
 *   C) "Where to go"            — OfficeDirections from municipality_offices
 *   D) "Documents we can prepare" — disabled GenerateDocButtons (37e) + the
 *      existing Compliance Report PDF (works today)
 *   E) Action row — MarkAsDoneButtons (standard: applied → received)
 */

import { DocumentChecklist } from '../DocumentChecklist'
import { FormSummaryCard, type FormSummaryRow } from '../FormSummaryCard'
import { OfficeDirections } from '../OfficeDirections'
import { GenerateDocButton } from '../GenerateDocButton'
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

export function TradingPermitStep({ step, data, t }: Props) {
  const goods = generateGoodsDescription(data.productNames)

  const formRows: FormSummaryRow[] = [
    {
      labelKey: 'form_full_name',
      value: null,
      missing: 'fill_at_office',
    },
    {
      labelKey: 'form_id_number',
      value: null,
      missing: 'fill_at_office',
    },
    {
      labelKey: 'form_phone',
      value: data.shop.whatsapp_number,
      missing: 'add_in_settings',
    },
    {
      labelKey: 'form_email',
      value: data.ownerEmail,
      missing: 'unknown',
    },
    {
      labelKey: 'form_shop_address',
      value: data.shop.location,
      missing: 'add_in_settings',
    },
    {
      labelKey: 'form_goods_sold',
      value: goods,
    },
  ]

  return (
    <>
      <DocumentChecklist
        requirements={data.permitRequirements}
        t={t}
        headerKey="permit_what_to_bring"
        fallbackKey="permit_requirements_fallback"
      />

      <FormSummaryCard rows={formRows} t={t} footerKey="form_bring_id_warning" />

      <OfficeDirections
        offices={data.permitOffices}
        areaText={data.shop.municipality_area_text ?? data.municipality?.short_name ?? null}
        t={t}
        headerKey="permit_where_to_go"
      />

      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">
          {t('permit_docs_we_prepare')}
        </h4>
        <div className="space-y-2">
          <GenerateDocButton
            titleKey="doc_landlord_affidavit_title"
            descriptionKey="doc_landlord_affidavit_desc"
            t={t}
          />
          <GenerateDocButton
            titleKey="doc_goods_affidavit_title"
            descriptionKey="doc_goods_affidavit_desc"
            t={t}
          />
          <GenerateDocButton
            titleKey="doc_compliance_report_title"
            descriptionKey="doc_compliance_report_desc"
            href="/api/reports/compliance-pdf"
            t={t}
          />
        </div>
      </section>

      <MarkAsDoneButtons step={step} t={t} variant="standard" hasExpiry={true} />
    </>
  )
}
