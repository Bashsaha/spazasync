'use client'

import { Shield } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'

interface Props {
  onContinue: () => void
}

export function WelcomeScreen({ onContinue }: Props) {
  const { t } = useTranslation('compliance-onboarding')
  return (
    <div className="flex flex-col gap-6 text-center py-6">
      <Shield className="w-12 h-12 mx-auto text-brand" strokeWidth={1.5} />
      <h2 className="text-xl font-bold text-gray-900">{t('welcome_title')}</h2>
      <p className="text-sm text-gray-600 leading-relaxed">{t('welcome_text')}</p>
      <p className="text-sm text-gray-400">{t('welcome_duration')}</p>
      <button
        type="button"
        onClick={onContinue}
        className="w-full bg-brand text-white font-semibold py-3 rounded-full active:bg-brand-hover text-base min-h-[48px] mt-2"
      >
        {t('btn_lets_go')}
      </button>
    </div>
  )
}
