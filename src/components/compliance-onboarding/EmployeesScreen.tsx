'use client'

import { Check } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'

interface Props {
  value: boolean | null
  onPick: (next: boolean) => void
}

export function EmployeesScreen({ value, onPick }: Props) {
  const { t } = useTranslation('compliance-onboarding')
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">{t('employees_title')}</h2>
      <p className="text-sm text-gray-600">{t('employees_subtitle')}</p>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onPick(true)}
          className={`w-full text-left rounded-full border px-4 py-3 text-sm font-medium ${
            value === true ? 'border-brand bg-brand-light text-brand-hover' : 'border-gray-200 bg-white text-gray-800'
          }`}
        >
          <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4" strokeWidth={2.25} />{t('employees_yes')}</span>
        </button>
        <button
          type="button"
          onClick={() => onPick(false)}
          className={`w-full text-left rounded-full border px-4 py-3 text-sm font-medium ${
            value === false ? 'border-brand bg-brand-light text-brand-hover' : 'border-gray-200 bg-white text-gray-800'
          }`}
        >
          {t('employees_no')}
        </button>
      </div>
    </div>
  )
}
