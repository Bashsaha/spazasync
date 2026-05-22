/**
 * Phase 39 — "Your next step" hero card.
 *
 * Surfaces the single most-actionable step above the full step list so the
 * owner can act without scrolling through everything. Uses an anchor link
 * so tapping "Go to this step" smoothly scrolls to the card below.
 *
 * Pick order: in_progress > not_started (unlocked) > locked.
 * Hidden when all steps are complete.
 */

import Link from 'next/link'
import {
  Landmark, Stethoscope, Building2, Wallet,
  Users, GraduationCap, ClipboardList, ShieldCheck,
  ArrowDown, type LucideIcon,
} from 'lucide-react'
import { journeyWhyKey } from '@/lib/compliance/nationality-divergence'
import type { ComplianceJourneyStep, JourneyStepKey } from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  steps: ComplianceJourneyStep[]
  t: T
  /** Swap the `_why` subtitle to its fund-free foreign variant where one exists. */
  isForeignNational?: boolean
}

const STEP_ICON: Record<JourneyStepKey, LucideIcon> = {
  right_to_trade: ShieldCheck,
  food_safety_training: GraduationCap,
  cipc: Building2,
  sars_tax: Wallet,
  coa: Stethoscope,
  municipal_registration: Landmark,
  uif: Users,
  smmesa: ClipboardList,
}

function pickNextStep(steps: ComplianceJourneyStep[]): ComplianceJourneyStep | null {
  return (
    steps.find((s) => s.status === 'in_progress') ??
    steps.find((s) => s.status === 'not_started') ??
    steps.find((s) => s.status === 'locked') ??
    null
  )
}

export function NextStepHero({ steps, t, isForeignNational = false }: Props) {
  const allDone = steps.every((s) => s.status === 'complete')
  if (allDone) return null

  const next = pickNextStep(steps)
  if (!next) return null

  const Icon = STEP_ICON[next.key]
  const isLocked = next.status === 'locked'

  return (
    <div className="bg-brand rounded-2xl px-5 py-4 mb-5">
      <p className="text-[10px] uppercase tracking-widest font-bold text-brand-light mb-2">
        {t('next_step_label')}
      </p>

      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-white" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-white/70 mb-0.5">
            {t('step_label', { n: next.stepNumber })}
          </p>
          <h2 className="text-base font-bold text-white leading-snug">
            {t(`step_${next.key}_title`)}
          </h2>
          <p className="text-sm text-white/80 mt-1 leading-snug">
            {isLocked
              ? t('next_step_locked_hint', {
                  steps: next.blockedBy.map((k) => t(`step_${k}_short`)).join(', '),
                })
              : t(journeyWhyKey(next.key, isForeignNational))}
          </p>
        </div>
      </div>

      <Link
        href={`#step-${next.key}`}
        className="flex items-center justify-center gap-2 bg-white text-brand font-bold text-sm rounded-full py-2.5 px-5 active:bg-brand-light transition-colors"
      >
        {isLocked ? t('next_step_cta_locked') : t('next_step_cta')}
        <ArrowDown className="w-4 h-4" strokeWidth={2} />
      </Link>
    </div>
  )
}
