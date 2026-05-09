/**
 * Phase 37c — Step 2: Health Certificate (Certificate of Acceptability).
 *
 * Reframes the existing inspection-readiness panel as "are you ready to
 * apply for your CoA?" and surfaces the same data without duplicating it.
 * The CoA expires every 24 months — `hasExpiry={true}` on the action row
 * surfaces the expiry date input on "I've received".
 */

import { InspectionReadinessPanel } from '@/components/compliance/InspectionReadinessPanel'
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
type InspT = (key: string, params?: Record<string, string | number>) => string

interface Props {
  step: ComplianceJourneyStep
  data: ComplianceJourneyData
  t: T
  /** `inspection`-namespace t() for the readiness panel labels. */
  tInsp: InspT
}

export function HealthCertificateStep({ step, data, t, tInsp }: Props) {
  const goods = generateGoodsDescription(data.productNames)
  const storageBits: string[] = []
  if (data.shop.has_fridge) storageBits.push(t('coa_storage_fridge'))
  if (data.shop.has_freezer) storageBits.push(t('coa_storage_freezer'))
  storageBits.push(t('coa_storage_shelving'))
  const storage = storageBits.join(', ')

  const formRows: FormSummaryRow[] = [
    { labelKey: 'form_person_in_charge', value: null, missing: 'fill_at_office' },
    { labelKey: 'form_id_number', value: null, missing: 'fill_at_office' },
    { labelKey: 'form_capacity', value: t('coa_capacity_owner') },
    { labelKey: 'form_phone', value: data.shop.whatsapp_number, missing: 'add_in_settings' },
    { labelKey: 'form_shop_address', value: data.shop.location, missing: 'add_in_settings' },
    { labelKey: 'coa_premises_type', value: t('coa_premises_spaza') },
    { labelKey: 'coa_food_handled', value: goods },
    { labelKey: 'coa_storage', value: storage },
  ]

  return (
    <>
      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">
          {t('coa_readiness_header')}
        </h4>
        <p className="text-xs text-gray-500 mb-2">
          {t('coa_readiness_intro', {
            passing: data.inspectionReadiness.passing,
            total: data.inspectionReadiness.total,
          })}
        </p>
        <InspectionReadinessPanel
          result={data.inspectionReadiness}
          t={tInsp}
          showHeader={false}
        />
      </section>

      <DocumentChecklist
        requirements={data.coaRequirements}
        t={t}
        headerKey="coa_what_to_bring"
        fallbackKey="coa_requirements_fallback"
      />

      <FormSummaryCard rows={formRows} t={t} footerKey="form_bring_id_warning" />

      <OfficeDirections
        offices={data.healthOffices}
        areaText={data.shop.municipality_area_text ?? data.municipality?.short_name ?? null}
        t={t}
        headerKey="coa_where_to_go"
      />

      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">
          {t('coa_evidence_header')}
        </h4>
        <div className="space-y-2">
          <GenerateDocButton
            titleKey="doc_evidence_pack_title"
            descriptionKey="doc_evidence_pack_desc"
            href="/api/reports/food-safety-pack"
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

      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        ⏰ {t('coa_renewal_note')}
      </p>

      <MarkAsDoneButtons step={step} variant="standard" hasExpiry={true} />
    </>
  )
}
