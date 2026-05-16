'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'

interface Props {
  /** Fallback path used when there is no entry in browser history (direct
   *  load, deep-link from a notification, etc.). */
  fallbackHref: string
  /** Optional className override. Defaults to the WhatsApp-style icon button. */
  className?: string
}

/** WhatsApp-style back arrow — icon-only, generous tap target. */
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
      aria-label={t('back')}
      className={
        className ??
        '-ml-2 inline-flex items-center justify-center w-10 h-10 rounded-full text-gray-700 active:bg-gray-100'
      }
    >
      <ArrowLeft className="w-6 h-6" strokeWidth={2.25} />
    </button>
  )
}
