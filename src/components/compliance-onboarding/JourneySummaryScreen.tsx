'use client'

import { Check, Circle, Wallet } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'
import { Spinner } from '@/components/Spinner'
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
                    ? 'border-brand-light bg-brand-light'
                    : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`flex items-center gap-1.5 text-sm font-medium ${
                  step.status === 'done' ? 'text-green-800' : 'text-gray-900'
                }`}>
                  {step.status === 'done' ? (
                    <Check className="w-4 h-4 text-green-600 shrink-0" strokeWidth={2.25} />
                  ) : (
                    <Circle className="w-4 h-4 text-red-500 shrink-0" strokeWidth={2} fill="currentColor" />
                  )}
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
        <p className="flex items-start gap-1.5 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3">
          <Wallet className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.75} />
          <span>{t('summary_fund_teaser')}</span>
        </p>
      )}

      <button
        type="button"
        onClick={onFinish}
        disabled={saving}
        className="w-full bg-brand text-white font-semibold py-3 rounded-full active:bg-brand-hover disabled:opacity-50 text-base min-h-[48px]"
      >
        {saving ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Spinner size="sm" />
            {t('btn_saving')}
          </span>
        ) : (
          t('btn_lets_get_started')
        )}
      </button>
    </div>
  )
}
