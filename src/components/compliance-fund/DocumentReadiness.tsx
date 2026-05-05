/**
 * Phase 37e — Document readiness list.
 *
 * Shows each fund-required document with its status and a deep-link to the
 * matching journey step when missing. Server component.
 */

import Link from 'next/link'
import type { FundReadinessDocRow } from '@/lib/compliance/fund'
import type { BusinessDocument, DocumentType } from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  rows: FundReadinessDocRow[]
  documents: BusinessDocument[]
  t: T
}

/** Each fund doc deep-links to its matching journey step on /compliance/journey. */
const STEP_HASH: Record<DocumentType, string> = {
  municipal_registration: 'step-municipal_registration',
  coa: 'step-coa',
  cipc: 'step-cipc',
  business_license: 'step-cipc',
  owner_id: 'step-municipal_registration',
  sars_tax: 'step-sars_tax',
  uif: 'step-uif',
  food_safety_training: 'step-food_safety_training',
  smmesa: 'step-smmesa',
}

export function DocumentReadiness({ rows, documents, t }: Props) {
  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-5 mb-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">
        {t('docs_header')}
      </h2>
      <ul className="divide-y divide-gray-100">
        {rows.map((row) => {
          const dbRow = documents.find((d) => d.document_type === row.document_type)
          const status = dbRow?.status ?? 'missing'
          return (
            <li key={row.document_type} className="py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {t(`doc_${row.document_type}_label`)}
                  </p>
                  {row.cipcConditional && !row.ok && (
                    <p className="text-xs text-amber-700 mt-0.5">
                      {t('doc_cipc_conditional_hint')}
                    </p>
                  )}
                  <p className="text-xs mt-0.5">
                    {row.ok ? (
                      <span className="text-emerald-700">
                        ✅ {t(`doc_status_${status}`)}
                        {dbRow?.reference_number ? ` · ${dbRow.reference_number}` : ''}
                      </span>
                    ) : (
                      <span className="text-red-700">
                        ❌ {t(`doc_status_${status}`)}
                      </span>
                    )}
                  </p>
                </div>
                {!row.ok && (
                  <Link
                    href={`/compliance/journey#${STEP_HASH[row.document_type]}`}
                    className="text-xs text-blue-600 font-semibold whitespace-nowrap active:text-blue-800"
                  >
                    {t('doc_fix_now')} →
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
