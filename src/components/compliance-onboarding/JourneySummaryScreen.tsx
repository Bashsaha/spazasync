'use client'

import { useTranslation } from '@/components/LanguageProvider'
import type { JourneyStep, NationalityType } from '@/types'

interface Props {
  steps: JourneyStep[]
  nationality: NationalityType | null
  fundInterest: boolean
  onFinish: () => void
  saving: boolean
}

export function JourneySummaryScreen({ steps, nationality, fundInterest, onFinish, saving }: Props) {
  const { t, tPlural } = useTranslation('compliance-onboarding')
  const todoCount = steps.filter((s) => s.status === 'todo').length
  const showFundTeaser = nationality === 'sa_citizen' && fundInterest && todoCount > 0

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">{t('summary_title')}</h2>
      <p className="text-sm text-gray-600">
        {tPlural('summary_subtitle', todoCount, { count: todoCount })}
      </p>

      <div className="space-y-2">
        {steps.map((step) => {
          const label = t(`doc_${step.document_type}`)
          const isStartHere = step.status === 'todo' && step.stepNumber === 1
          return (
            <div
              key={step.document_type}
              className={`rounded-xl border px-4 py-3 ${
                step.status === 'done'
                  ? 'border-green-200 bg-green-50'
                  : isStartHere
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`text-sm font-medium ${
                  step.status === 'done' ? 'text-green-800' : 'text-gray-900'
                }`}>
                  {step.status === 'done' ? '✅ ' : '🔴 '}
                  {label}
                </span>
                <span className="text-xs whitespace-nowrap text-gray-500">
                  {step.status === 'done'
                    ? t('summary_step_done')
                    : isStartHere
                      ? t('summary_step_start_here', { n: step.stepNumber ?? 1 })
                      : t('summary_step_todo', { n: step.stepNumber ?? 1 })}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {showFundTeaser && (
        <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3">
          💰 {t('summary_fund_teaser')}
        </p>
      )}

      <button
        type="button"
        onClick={onFinish}
        disabled={saving}
        className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl active:bg-blue-700 disabled:opacity-50 text-base min-h-[48px]"
      >
        {saving ? t('btn_saving') : t('btn_lets_get_started')}
      </button>
    </div>
  )
}
