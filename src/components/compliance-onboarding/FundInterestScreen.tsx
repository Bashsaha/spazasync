'use client'

import { useTranslation } from '@/components/LanguageProvider'

interface Props {
  value: boolean | null
  onPick: (next: boolean) => void
}

export function FundInterestScreen({ value, onPick }: Props) {
  const { t } = useTranslation('compliance-onboarding')
  return (
    <div className="space-y-5">
      <div className="text-4xl">💰</div>
      <h2 className="text-xl font-bold text-gray-900">{t('fund_title')}</h2>
      <p className="text-sm text-gray-600 leading-relaxed">{t('fund_intro')}</p>
      <p className="text-sm font-medium text-gray-800">{t('fund_question')}</p>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onPick(true)}
          className={`w-full text-left rounded-xl border px-4 py-3 text-sm font-medium ${
            value === true ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-800'
          }`}
        >
          ✅ {t('fund_yes')}
        </button>
        <button
          type="button"
          onClick={() => onPick(false)}
          className={`w-full text-left rounded-xl border px-4 py-3 text-sm font-medium ${
            value === false ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-800'
          }`}
        >
          {t('fund_no')}
        </button>
      </div>
    </div>
  )
}
