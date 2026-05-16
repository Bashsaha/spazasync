/**
 * Step: Health Certificate (Certificate of Acceptability, R638 of 2018).
 *
 * R638 sets NO fixed national expiry — re-apply only if shop address,
 * ownership, or person-in-charge changes. Municipalities may schedule
 * periodic re-inspections. `hasExpiry={true}` keeps the optional expiry
 * date field if the owner's municipality does issue a dated certificate.
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
      {/* Numbered how-to */}
      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">{t('coa_how_header')}</h4>
        <ol className="space-y-2">
          {(['coa_how_step_1','coa_how_step_2','coa_how_step_3','coa_how_step_4','coa_how_step_5'] as const).map((key, i) => (
            <li key={key} className="flex gap-2.5 text-sm text-gray-700">
              <span className="w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ol>
      </section>

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

      <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
        ℹ️ {t('coa_no_fixed_expiry_note')}
      </p>
      <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
        ⏱ {t('coa_processing_time_note')}
      </p>
      <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
        📋 {t('coa_display_requirement_note')}
      </p>

      <MarkAsDoneButtons step={step} variant="standard" hasExpiry={true} />
    </>
  )
}
