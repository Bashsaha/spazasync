'use client'

import { useTranslation } from '@/components/LanguageProvider'
import type { DocumentToggleState } from '@/types'

interface DocumentToggleCardProps {
  label: string
  state: DocumentToggleState
  onCycle: (next: DocumentToggleState) => void
}

const NEXT: Record<DocumentToggleState, DocumentToggleState> = {
  unselected: 'have',
  have: 'unsure',
  unsure: 'unselected',
}

const STATE_STYLES: Record<DocumentToggleState, string> = {
  unselected: 'border-gray-200 bg-white text-gray-700',
  have: 'border-green-300 bg-green-50 text-green-800',
  unsure: 'border-amber-300 bg-amber-50 text-amber-800',
}

const STATE_BADGE: Record<DocumentToggleState, string> = {
  unselected: '',
  have: '✅',
  unsure: '❓',
}

export function DocumentToggleCard({ label, state, onCycle }: DocumentToggleCardProps) {
  const { t } = useTranslation('compliance-onboarding')
  const stateLabelKey =
    state === 'have' ? 'documents_state_have'
    : state === 'unsure' ? 'documents_state_unsure'
    : 'documents_state_unselected'

  return (
    <button
      type="button"
      onClick={() => onCycle(NEXT[state])}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${STATE_STYLES[state]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium leading-tight">{label}</span>
        <span className="text-xs whitespace-nowrap">
          {STATE_BADGE[state]} {t(stateLabelKey)}
        </span>
      </div>
    </button>
  )
}
