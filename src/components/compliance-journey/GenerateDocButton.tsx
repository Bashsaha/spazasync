'use client'

/**
 * Phase 37c — "Generate PDF" button.
 * Phase 37d enabled real PDF endpoints for trading permit summary, landlord
 * affidavit, goods declaration, food-safety pack, and the fund application
 * pack. Unset `href` still falls back to the "Coming in next update" pill.
 * Phase 41a — when the parent JourneyStep is locked the link is replaced by
 * a disabled pill: plan-ahead content stays visible but you can't generate
 * pre-filled paperwork until prerequisite steps are complete.
 */

import Link from 'next/link'
import { FileText, Lock } from 'lucide-react'
import { useJourneyLocked } from './JourneyStep'

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
  const isLocked = useJourneyLocked()
  const isEnabled = !!href && !isLocked

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
      ) : isLocked ? (
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-gray-100 text-gray-400 text-sm font-semibold rounded-full cursor-not-allowed"
        >
          <Lock className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
          {t('btn_generate_locked')}
        </button>
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
