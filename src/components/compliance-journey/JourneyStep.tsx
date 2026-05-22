'use client'

/**
 * Phase 37c — generic collapsible step card.
 * Phase 41a — when locked, plan-ahead content (what to bring, where to go,
 *   how-to checklist, form summary) STAYS VISIBLE so owners can prepare in
 *   advance. Only action buttons (Mark as done, Generate PDF) are gated.
 *   Lock state is broadcast via JourneyLockContext so child action components
 *   can disable themselves without each step having to thread the prop.
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
 */

import { createContext, useContext, useState, type ReactNode } from 'react'
import { Landmark, Stethoscope, Building2, Wallet, Users, GraduationCap, ClipboardList, ShieldCheck, ChevronDown, Lock, type LucideIcon } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'
import { journeyWhyKey } from '@/lib/compliance/nationality-divergence'
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

/**
 * Phase 41a — broadcasts the step's lock state to action components nested
 * inside `children`. MarkAsDoneButtons + GenerateDocButton read this and
 * disable themselves when locked, instead of being hidden entirely. The
 * plan-ahead content (what to bring, where to go, how-to checklist) stays
 * visible regardless of lock state.
 */
const JourneyLockContext = createContext<boolean>(false)

export function useJourneyLocked(): boolean {
  return useContext(JourneyLockContext)
}

interface Props {
  step: ComplianceJourneyStep
  defaultExpanded?: boolean
  children: ReactNode
  /** id attribute on the outer section — used by NextStepHero scroll anchor. */
  id?: string
  /** Swap the `_why` subtitle to its fund-free foreign variant where one exists. */
  isForeignNational?: boolean
}

const STEP_ICON: Record<JourneyStepKey, LucideIcon> = {
  right_to_trade: ShieldCheck,
  municipal_registration: Landmark,
  coa: Stethoscope,
  cipc: Building2,
  sars_tax: Wallet,
  uif: Users,
  food_safety_training: GraduationCap,
  smmesa: ClipboardList,
}

export function JourneyStep({ step, defaultExpanded, children, id, isForeignNational = false }: Props) {
  const { t } = useTranslation('compliance-journey')
  const [expanded, setExpanded] = useState(Boolean(defaultExpanded))
  const badge = STATUS_BADGE[step.status]
  const titleKey = `step_${step.key}_title`
  const whyKey = journeyWhyKey(step.key, isForeignNational)
  const isLocked = step.status === 'locked'
  const isComplete = step.status === 'complete'

  return (
    <section
      id={id}
      className={`bg-white rounded-2xl border ${badge.ring} mb-3 overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-4 active:bg-gray-50"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          {(() => {
            const Icon = STEP_ICON[step.key]
            return <Icon className="w-7 h-7 text-brand shrink-0" strokeWidth={1.75} aria-hidden="true" />
          })()}
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
          <ChevronDown className={`w-5 h-5 shrink-0 text-gray-400 ${expanded ? 'rotate-180' : ''} transition-transform`} strokeWidth={1.75} />
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
          {isLocked && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" strokeWidth={2} aria-hidden="true" />
              <div className="text-xs text-amber-800">
                <p className="font-semibold mb-0.5">
                  {t('step_locked_plan_ahead_title')}
                </p>
                <p>
                  {t('step_locked_plan_ahead_body', {
                    steps: step.blockedBy.map((k) => t(`step_${k}_short`)).join(', '),
                  })}
                </p>
              </div>
            </div>
          )}
          <JourneyLockContext.Provider value={isLocked}>
            {children}
          </JourneyLockContext.Provider>
        </div>
      )}
    </section>
  )
}
