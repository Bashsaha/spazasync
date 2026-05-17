'use client'

/**
 * Phase 37c — "Generate PDF" button.
 * Phase 37d enabled real PDF endpoints for trading permit summary, landlord
 * affidavit, goods declaration, food-safety pack, and the fund application
 * pack. Unset `href` still falls back to the "Coming in next update" pill.
 *
 * Phase 41b — DROPPED the BUG-035 lock entirely. Every Movestock-generated PDF
 * is a "plan-ahead" artefact (cheat-sheet to copy onto an official form, or a
 * personalised evidence pack of records captured outside the step). None of
 * them depend on the step actually being unlocked, so gating their download
 * was over-correction. Lock gating now lives only on MarkAsDoneButtons —
 * where it genuinely matters (would push the journey engine into inconsistent
 * state). Owners can prepare all paperwork in advance.
 */

import Link from 'next/link'
import { FileText } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'

interface Props {
  /** i18n key for the document title (e.g. 'doc_landlord_affidavit'). */
  titleKey: string
  /** i18n key for the explainer copy. */
  descriptionKey: string
  /**
   * When set, the button is enabled and links to this href. When omitted, the
   * button renders disabled with the "Coming in next update" hint.
   */
  href?: string
}

export function GenerateDocButton({ titleKey, descriptionKey, href }: Props) {
  const { t } = useTranslation('compliance-journey')
  const isEnabled = !!href

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <FileText className="w-6 h-6 mb-2 text-brand" strokeWidth={1.75} aria-hidden="true" />
      <p className="font-semibold text-gray-900">{t(titleKey)}</p>
      <p className="text-sm text-gray-500 mt-1">{t(descriptionKey)}</p>
      {isEnabled ? (
        <Link
          href={href!}
          className="inline-flex items-center mt-3 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-full active:bg-brand-hover"
        >
          {t('btn_generate_pdf')}
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="inline-flex items-center mt-3 px-4 py-2 bg-gray-100 text-gray-400 text-sm font-semibold rounded-full cursor-not-allowed"
          title={t('btn_generate_coming_soon')}
        >
          {t('btn_generate_coming_soon')}
        </button>
      )}
    </div>
  )
}
