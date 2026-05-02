'use client'

import { useState } from 'react'
import { useTranslation } from '@/components/LanguageProvider'

interface OnboardingBannerProps {
  onStart: () => void
}

/**
 * Dashboard banner ("Complete your compliance check") — rendered by
 * DashboardComplianceOnboarding for owners whose shop hasn't completed
 * the compliance flow yet. Snooze logic lives server-side; this component
 * just shows the banner and posts /api/compliance-onboarding/dismiss when
 * the user taps "Not now".
 */
export function OnboardingBanner({ onStart }: OnboardingBannerProps) {
  const { t } = useTranslation('compliance-onboarding')
  const [hidden, setHidden] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  if (hidden) return null

  async function handleDismiss() {
    setDismissing(true)
    try {
      await fetch('/api/compliance-onboarding/dismiss', { method: 'POST' })
    } catch {
      /* network failure — banner re-shows on next dashboard load anyway */
    }
    setHidden(true)
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
      <p className="font-semibold text-blue-900">{t('banner_title')}</p>
      <p className="text-sm text-blue-700 mt-1">{t('banner_subtitle')}</p>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={onStart}
          className="flex-1 bg-blue-600 text-white font-semibold py-2 rounded-xl active:bg-blue-700 text-sm"
        >
          {t('banner_btn_start')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          className="px-4 bg-white border border-blue-200 text-blue-700 font-medium py-2 rounded-xl active:bg-blue-100 text-sm disabled:opacity-50"
        >
          {t('banner_btn_later')}
        </button>
      </div>
    </div>
  )
}
