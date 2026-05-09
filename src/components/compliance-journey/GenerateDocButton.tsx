/**
 * Phase 37c — "Generate PDF" button.
 *
 * Per the plan, real PDF generation for affidavits + evidence packs is Phase
 * 37e. In 37c we render the buttons disabled with a "Coming in next update"
 * label so the journey UI is feature-complete on day one. The Compliance
 * Report PDF (existing /api/reports/compliance-pdf endpoint) is the one
 * exception — it ships enabled.
 */

import Link from 'next/link'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  /** i18n key for the document title (e.g. 'doc_landlord_affidavit'). */
  titleKey: string
  /** i18n key for the explainer copy. */
  descriptionKey: string
  /**
   * When set, the button is enabled and links to this href (used for the
   * existing compliance PDF endpoint). When omitted, the button renders
   * disabled with the "Coming in next update" hint.
   */
  href?: string
  t: T
}

export function GenerateDocButton({ titleKey, descriptionKey, href, t }: Props) {
  const isEnabled = !!href

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <p className="text-2xl mb-2" aria-hidden="true">📄</p>
      <p className="font-semibold text-gray-900">{t(titleKey)}</p>
      <p className="text-sm text-gray-500 mt-1">{t(descriptionKey)}</p>
      {isEnabled ? (
        <Link
          href={href}
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
