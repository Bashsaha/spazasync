'use client'

import { useTranslation } from '@/components/LanguageProvider'
import { DocumentToggleCard } from './DocumentToggleCard'
import type { DocumentToggleState, OnboardingDocumentType } from '@/types'

interface Props {
  hasEmployees: boolean
  states: Partial<Record<OnboardingDocumentType, DocumentToggleState>>
  onChange: (
    next: Partial<Record<OnboardingDocumentType, DocumentToggleState>>,
  ) => void
}

const ROW_ORDER: OnboardingDocumentType[] = [
  'municipal_registration',
  'coa',
  'cipc',
  'sars_tax',
  'uif',
]

export function DocumentStatusScreen({ hasEmployees, states, onChange }: Props) {
  const { t } = useTranslation('compliance-onboarding')

  function setState(type: OnboardingDocumentType, next: DocumentToggleState) {
    onChange({ ...states, [type]: next })
  }

  const visible = ROW_ORDER.filter((t) => t !== 'uif' || hasEmployees)

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">{t('documents_title')}</h2>
      <p className="text-sm text-gray-600">{t('documents_subtitle')}</p>
      <div className="space-y-3">
        {visible.map((type) => (
          <DocumentToggleCard
            key={type}
            label={t(`doc_${type}`)}
            state={states[type] ?? 'unselected'}
            onCycle={(next) => setState(type, next)}
          />
        ))}
      </div>
    </div>
  )
}
