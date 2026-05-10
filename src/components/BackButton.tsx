'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'

interface Props {
  /** Fallback path used when there is no entry in browser history (direct
   *  load, deep-link from a notification, etc.). */
  fallbackHref: string
  /** Optional className override (defaults to the muted-grey style used by
   *  the existing back arrows across the app). */
  className?: string
}

/** Browser-history back arrow. Used on pages that are reached from multiple
 *  parents (e.g. /compliance/journey from both /profile and /manage) so the
 *  back arrow goes wherever the user actually came from instead of a single
 *  hardcoded ancestor.
 */
export function BackButton({ fallbackHref, className }: Props) {
  const router = useRouter()
  const { t } = useTranslation('common')

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={className ?? 'text-gray-400 active:text-gray-600 text-sm'}
    >
      ‹ {t('back')}
    </button>
  )
}
