'use client'

import { Wallet, Check } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'

interface Props {
  value: boolean | null
  onPick: (next: boolean) => void
}

export function FundInterestScreen({ value, onPick }: Props) {
  const { t } = useTranslation('compliance-onboarding')
  return (
    <div className="space-y-5">
      <Wallet className="w-10 h-10 text-brand" strokeWidth={1.5} />
      <h2 className="text-xl font-bold text-gray-900">{t('fund_title')}</h2>
      <p className="text-sm text-gray-600 leading-relaxed">{t('fund_intro')}</p>
      <p className="text-sm font-medium text-gray-800">{t('fund_question')}</p>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onPick(true)}
          className={`w-full text-left rounded-full border px-4 py-3 text-sm font-medium ${
            value === true ? 'border-brand bg-brand-light text-brand-hover' : 'border-gray-200 bg-white text-gray-800'
          }`}
        >
          <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4" strokeWidth={2.25} />{t('fund_yes')}</span>
        </button>
        <button
          type="button"
          onClick={() => onPick(false)}
          className={`w-full text-left rounded-full border px-4 py-3 text-sm font-medium ${
            value === false ? 'border-brand bg-brand-light text-brand-hover' : 'border-gray-200 bg-white text-gray-800'
          }`}
        >
          {t('fund_no')}
        </button>
      </div>
    </div>
  )
}
