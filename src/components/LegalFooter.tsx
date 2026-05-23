'use client'

import Link from 'next/link'
import { useTranslation } from '@/components/LanguageProvider'

/**
 * Small, unobtrusive legal footer shown under the login + onboarding forms.
 * Surfaces the "by continuing you agree" line + Terms/Privacy links without
 * blocking the path to the app (no modal, no checkbox). Link labels come from
 * the `common` namespace; the destination pages are English-only by design.
 */
export function LegalFooter() {
  const { t } = useTranslation()
  return (
    <p className="text-center text-xs text-gray-400 px-6 pb-8 leading-relaxed">
      {t('legal_continue_agree')}{' '}
      <Link href="/legal/terms" className="underline hover:text-brand">
        {t('legal_terms')}
      </Link>
      {' & '}
      <Link href="/legal/privacy" className="underline hover:text-brand">
        {t('legal_privacy')}
      </Link>
      .
    </p>
  )
}
