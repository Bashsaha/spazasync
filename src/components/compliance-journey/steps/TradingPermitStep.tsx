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

import { AlertTriangle } from 'lucide-react'
import { DocumentChecklist } from '../DocumentChecklist'
import { FormSummaryCard, type FormSummaryRow } from '../FormSummaryCard'
import { OfficeDirections } from '../OfficeDirections'
import { OfficialFormCallout } from '../OfficialFormCallout'
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
  /** Phase 37f — swap ID-number copy for passport copy + add visa-link notice. */
  isForeignNational?: boolean
}

export function TradingPermitStep({ step, data, t, isForeignNational = false }: Props) {
  const goods = generateGoodsDescription(data.productNames)

  const formRows: FormSummaryRow[] = [
    {
      labelKey: 'form_full_name',
      value: null,
      missing: 'fill_at_office',
    },
    {
      labelKey: isForeignNational ? 'form_passport_number' : 'form_id_number',
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
      {/* Phase 41b — surface the official metro form/portal at the top so owners
          know up front where the actual government form lives. Movestock's
          pre-filled summary further down is a cheat-sheet, not the form itself. */}
      <OfficialFormCallout offices={data.permitOffices} t={t} />

      {/* Numbered how-to */}
      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">{t('permit_how_header')}</h4>
        <ol className="space-y-2">
          {(['permit_how_step_1','permit_how_step_2','permit_how_step_3','permit_how_step_4','permit_how_step_5'] as const).map((key, i) => (
            <li key={key} className="flex gap-2.5 text-sm text-gray-700">
              <span className="w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ol>
      </section>

      {isForeignNational && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={1.75} />
          <span>{t('permit_foreign_visa_link_notice')}</span>
        </p>
      )}

      <DocumentChecklist
        requirements={data.permitRequirements}
        t={t}
        headerKey="permit_what_to_bring"
        fallbackKey="permit_requirements_fallback"
      />

      <FormSummaryCard
        rows={formRows}
        t={t}
        footerKey={isForeignNational ? 'form_bring_passport_warning' : 'form_bring_id_warning'}
      />

      <OfficeDirections
        offices={data.permitOffices}
        areaText={data.shop.municipality_area_text ?? data.municipality?.short_name ?? null}
        t={t}
        headerKey="permit_where_to_go"
      />

      {/* Phase 41c — Trading Permit only requires the two affidavits, both of
          which need a Commissioner of Oaths stamp at the police station (so a
          downloadable template genuinely saves the owner work). The previous
          "Trading Permit Summary" cheat-sheet PDF was redundant with the
          on-page FormSummaryCard above + the official metro form linked via
          OfficialFormCallout. The Compliance Report belonged on the CoA step
          (where it's evidence for the inspector), not here — Joburg's permit
          attachment list does not request it. */}
      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">
          {t('permit_docs_we_prepare')}
        </h4>
        <div className="space-y-2">
          <GenerateDocButton
            titleKey="doc_landlord_affidavit_title"
            descriptionKey="doc_landlord_affidavit_desc"
            href="/api/reports/landlord-affidavit"
          />
          <GenerateDocButton
            titleKey="doc_goods_affidavit_title"
            descriptionKey="doc_goods_affidavit_desc"
            href="/api/reports/goods-declaration"
          />
        </div>
      </section>

      <MarkAsDoneButtons step={step} variant="standard" hasExpiry={true} />
    </>
  )
}
