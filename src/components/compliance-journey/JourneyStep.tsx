'use client'

/**
 * Phase 37c — generic collapsible step card.
 *
 * Client component because it owns the expand/collapse state. The step-specific
 * body content is passed via `children` and is server-rendered by the page —
 * Next.js allows server components to be passed through client components.
 *
 * Status badges follow the spec:
 *   not_started  → 🔴
 *   in_progress  → 🟡
 *   complete     → 🟢
 *   locked       → 🔒  (header explains which step is blocking)
 *
 * Auto-expansion: the page passes `defaultExpanded` for whichever step is the
 * "current" step (first non-complete). Owners can collapse it to focus
 * elsewhere; locked steps default closed.
 */

import { useState, type ReactNode } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import type {
  ComplianceJourneyStep,
  JourneyStepKey,
} from '@/types'

const STATUS_BADGE: Record<
  ComplianceJourneyStep['status'],
  { dot: string; text: string; ring: string; pill: string }
> = {
  not_started: {
    dot: 'bg-red-500',
    text: 'text-red-700',
    ring: 'border-red-200',
    pill: 'bg-red-50 text-red-700 border-red-200',
  },
  in_progress: {
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    ring: 'border-amber-200',
    pill: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  complete: {
    dot: 'bg-green-500',
    text: 'text-green-700',
    ring: 'border-green-200',
    pill: 'bg-green-50 text-green-700 border-green-200',
  },
  locked: {
    dot: 'bg-gray-400',
    text: 'text-gray-500',
    ring: 'border-gray-200',
    pill: 'bg-gray-50 text-gray-500 border-gray-200',
  },
}

interface Props {
  step: ComplianceJourneyStep
  defaultExpanded?: boolean
  children: ReactNode
}

const STEP_ICON: Record<JourneyStepKey, string> = {
  municipal_registration: '🏛️',
  coa: '🩺',
  cipc: '🏢',
  sars_tax: '💰',
  uif: '👥',
  food_safety_training: '🎓',
  smmesa: '📋',
}

export function JourneyStep({ step, defaultExpanded, children }: Props) {
  const { t } = useTranslation('compliance-journey')
  const [expanded, setExpanded] = useState(Boolean(defaultExpanded))
  const badge = STATUS_BADGE[step.status]
  const titleKey = `step_${step.key}_title`
  const whyKey = `step_${step.key}_why`
  const isLocked = step.status === 'locked'
  const isComplete = step.status === 'complete'

  return (
    <section
      className={`bg-white rounded-2xl border ${badge.ring} mb-3 overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-4 active:bg-gray-50"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0" aria-hidden="true">
            {STEP_ICON[step.key]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full border ${badge.pill}`}
              >
                {t(`status_${step.status}`)}
              </span>
              <span className="text-xs text-gray-400">
                {t('step_label', { n: step.stepNumber })}
              </span>
            </div>
            <h3 className={`text-base font-bold ${isComplete ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
              {t(titleKey)}
            </h3>
            {isLocked ? (
              <p className="text-sm text-gray-500 mt-1">
                {t('step_locked_reason', {
                  steps: step.blockedBy.map((k) => t(`step_${k}_short`)).join(', '),
                })}
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-1">{t(whyKey)}</p>
            )}
          </div>
          <span className={`shrink-0 text-gray-400 ${expanded ? 'rotate-180' : ''} transition-transform`}>
            ▾
          </span>
        </div>
      </button>
      {expanded && !isLocked && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
          {children}
        </div>
      )}
      {expanded && isLocked && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-500">{t('step_locked_body')}</p>
        </div>
      )}
    </section>
  )
}
