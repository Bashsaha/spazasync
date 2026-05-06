'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import type {
  ComplianceOnboardingPayload,
  DocumentToggleState,
  JourneyStep,
  NationalityType,
  OnboardingDocumentType,
  VisaType,
} from '@/types'
import { buildJourneySteps } from '@/lib/compliance/onboarding'
import { WelcomeScreen } from './WelcomeScreen'
import { NationalityScreen } from './NationalityScreen'
import { VisaScreen, type VisaScreenValue } from './VisaScreen'
import { MunicipalityScreen } from './MunicipalityScreen'
import { EmployeesScreen } from './EmployeesScreen'
import { DocumentStatusScreen } from './DocumentStatusScreen'
import { FoodSafetyScreen } from './FoodSafetyScreen'
import { FundInterestScreen } from './FundInterestScreen'
import { JourneySummaryScreen } from './JourneySummaryScreen'
import type { AreaPickerValue } from './AreaPicker'

interface ComplianceOnboardingModalProps {
  open: boolean
  onClose: () => void
  /** Fired after a successful submit so the parent can refresh dashboard data. */
  onCompleted?: () => void
  /** Optional pre-fill for Screen 3: if the shop already has a known
   *  municipality, render Screen 3 as a confirm step. */
  preFilledMunicipality?: { id: string; name: string } | null
  /** Pre-populate document toggles from existing business_documents rows. */
  initialDocumentStates?: Partial<Record<OnboardingDocumentType, DocumentToggleState>>
  /** Pre-fill nationality / training answers from owner_profiles. */
  initialNationality?: NationalityType | null
  initialFoodSafety?: { completed: boolean; date: string | null; provider: string | null }
  initialVisa?: { type: VisaType | null; expiryDate: string | null }
}

type ScreenKey =
  | 'welcome'
  | 'nationality'
  | 'visa'
  | 'municipality'
  | 'employees'
  | 'documents'
  | 'food_safety'
  | 'fund'
  | 'summary'

export function ComplianceOnboardingModal({
  open,
  onClose,
  onCompleted,
  preFilledMunicipality = null,
  initialDocumentStates = {},
  initialNationality = null,
  initialFoodSafety,
  initialVisa,
}: ComplianceOnboardingModalProps) {
  const { t } = useTranslation('compliance-onboarding')
  const [screen, setScreen] = useState<ScreenKey>('welcome')
  const [nationality, setNationality] = useState<NationalityType | null>(initialNationality)
  const [visa, setVisa] = useState<VisaScreenValue>({
    type: initialVisa?.type ?? null,
    expiryDate: initialVisa?.expiryDate ?? null,
    dontKnow: !!initialVisa && initialVisa.expiryDate == null && initialVisa.type != null,
  })
  const [area, setArea] = useState<AreaPickerValue>(
    preFilledMunicipality
      ? { municipality_id: preFilledMunicipality.id, municipality_area_text: null }
      : { municipality_id: null, municipality_area_text: null },
  )
  const [hasEmployees, setHasEmployees] = useState<boolean | null>(null)
  const [documentStates, setDocumentStates] = useState<
    Partial<Record<OnboardingDocumentType, DocumentToggleState>>
  >(initialDocumentStates)
  const [foodSafety, setFoodSafety] = useState<{
    completed: boolean | null
    date: string | null
    provider: string | null
  }>({
    completed: initialFoodSafety?.completed ?? null,
    date: initialFoodSafety?.date ?? null,
    provider: initialFoodSafety?.provider ?? null,
  })
  const [fundInterest, setFundInterest] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [journey, setJourney] = useState<JourneyStep[]>([])

  // Reset state when reopening
  useEffect(() => {
    if (open) {
      setScreen('welcome')
      setError(null)
    }
  }, [open])

  const orderedScreens = useMemo<ScreenKey[]>(() => {
    const base: ScreenKey[] = ['nationality']
    if (nationality === 'foreign_national') base.push('visa')
    base.push('municipality', 'employees', 'documents', 'food_safety')
    if (nationality !== 'foreign_national') base.push('fund')
    base.push('summary')
    return base
  }, [nationality])

  const currentIndex = screen === 'welcome' ? -1 : orderedScreens.indexOf(screen)

  function next() {
    if (screen === 'welcome') {
      setScreen('nationality')
      return
    }
    const idx = orderedScreens.indexOf(screen)
    if (idx >= 0 && idx < orderedScreens.length - 1) {
      setScreen(orderedScreens[idx + 1])
    }
  }

  function back() {
    if (screen === 'welcome') return
    if (screen === 'nationality') {
      setScreen('welcome')
      return
    }
    const idx = orderedScreens.indexOf(screen)
    if (idx > 0) setScreen(orderedScreens[idx - 1])
  }

  // Per-screen "can advance" gate. Without this the user could click Continue
  // with no answer and we'd silently submit nulls server-side.
  const canAdvance = useMemo(() => {
    switch (screen) {
      case 'welcome':
        return true
      case 'nationality':
        return nationality !== null
      case 'visa':
        // Type is required; date is required unless "dontKnow" is checked.
        if (visa.type === null) return false
        if (!visa.dontKnow && !visa.expiryDate) return false
        return true
      case 'municipality':
        return area.municipality_id != null || (area.municipality_area_text ?? '').trim().length > 0
      case 'employees':
        return hasEmployees !== null
      case 'documents':
        return true       // toggles default to 'unselected' which is a valid answer
      case 'food_safety':
        if (foodSafety.completed === null) return false
        if (foodSafety.completed && !foodSafety.date) return false
        return true
      case 'fund':
        return fundInterest !== null
      case 'summary':
        return true
      default:
        return false
    }
  }, [screen, nationality, area, hasEmployees, foodSafety, fundInterest, visa])

  async function handleFinish() {
    if (!nationality || hasEmployees === null) return
    setSaving(true)
    setError(null)
    const isForeign = nationality === 'foreign_national'
    const payload: ComplianceOnboardingPayload = {
      nationality_type: nationality,
      municipality_id: area.municipality_id ?? null,
      municipality_area_text: area.municipality_id ? null : area.municipality_area_text,
      has_employees: hasEmployees,
      document_states: documentStates,
      food_safety_training_completed: foodSafety.completed === true,
      food_safety_training_date: foodSafety.completed ? foodSafety.date : null,
      food_safety_training_provider: foodSafety.completed ? foodSafety.provider : null,
      fund_interest: nationality === 'sa_citizen' ? fundInterest === true : false,
      visa_type: isForeign ? visa.type : null,
      visa_expiry_date: isForeign && !visa.dontKnow ? visa.expiryDate : null,
    }
    try {
      const res = await fetch('/api/compliance-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? t('error_save_failed'))
        setSaving(false)
        return
      }
      onCompleted?.()
      onClose()
    } catch {
      setError(t('error_save_failed'))
    } finally {
      setSaving(false)
    }
  }

  // Screen 8 needs the journey computed locally so the user sees it before
  // hitting submit; we recompute on every render of summary.
  useEffect(() => {
    if (screen === 'summary') {
      setJourney(
        buildJourneySteps({
          has_employees: hasEmployees ?? false,
          document_states: documentStates,
          food_safety_training_completed: foodSafety.completed === true,
        }),
      )
    }
  }, [screen, hasEmployees, documentStates, foodSafety.completed])

  if (!open) return null

  const showProgress = screen !== 'welcome'
  const progress = showProgress ? `${currentIndex + 1} / ${orderedScreens.length}` : ''

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" role="dialog" aria-modal="true">
      <div className="bg-white w-full rounded-t-2xl px-5 pt-5 pb-8 max-h-[100vh] flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2 -mx-5 px-5 border-b border-gray-100">
          {screen !== 'welcome' ? (
            <button
              type="button"
              onClick={back}
              className="text-sm text-blue-600 font-medium"
            >
              {t('btn_back')}
            </button>
          ) : (
            <span />
          )}
          {showProgress && (
            <span className="text-xs text-gray-500 font-medium">{progress}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-400"
            aria-label={t('btn_close')}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 pb-4">
          {screen === 'welcome' && <WelcomeScreen onContinue={next} />}
          {screen === 'nationality' && (
            <NationalityScreen value={nationality} onPick={setNationality} />
          )}
          {screen === 'visa' && (
            <VisaScreen value={visa} onChange={setVisa} />
          )}
          {screen === 'municipality' && (
            <MunicipalityScreen
              preFilledName={preFilledMunicipality?.name ?? null}
              value={area}
              onChange={setArea}
            />
          )}
          {screen === 'employees' && (
            <EmployeesScreen value={hasEmployees} onPick={setHasEmployees} />
          )}
          {screen === 'documents' && (
            <DocumentStatusScreen
              hasEmployees={hasEmployees ?? false}
              states={documentStates}
              onChange={setDocumentStates}
            />
          )}
          {screen === 'food_safety' && (
            <FoodSafetyScreen value={foodSafety} onChange={setFoodSafety} />
          )}
          {screen === 'fund' && (
            <FundInterestScreen value={fundInterest} onPick={setFundInterest} />
          )}
          {screen === 'summary' && (
            <JourneySummaryScreen
              steps={journey}
              nationality={nationality}
              fundInterest={fundInterest === true}
              onFinish={handleFinish}
              saving={saving}
            />
          )}
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}

        {/* Footer — Continue button on every screen except welcome (its own CTA) and summary (its own Finish button) */}
        {screen !== 'welcome' && screen !== 'summary' && (
          <button
            type="button"
            onClick={next}
            disabled={!canAdvance}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl active:bg-blue-700 disabled:opacity-40 text-base min-h-[48px]"
          >
            {t('btn_continue')}
          </button>
        )}
      </div>
    </div>
  )
}
