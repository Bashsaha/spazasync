'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ComplianceOnboardingModal } from './ComplianceOnboardingModal'
import { OnboardingBanner } from './OnboardingBanner'
import {
  shouldShowComplianceBanner,
  documentStatusToToggleState,
} from '@/lib/compliance/onboarding'
import type {
  DocumentStatus,
  DocumentToggleState,
  NationalityType,
  OnboardingDocumentType,
  VisaType,
} from '@/types'

interface ExistingDoc {
  document_type: OnboardingDocumentType
  status: DocumentStatus
}

interface ShopOnboardingState {
  onboarding_compliance_completed: boolean
  onboarding_compliance_dismissed_at: string | null
  onboarding_compliance_dismiss_count: number
}

interface Props {
  shop: ShopOnboardingState
  preFilledMunicipality: { id: string; name: string } | null
  existingDocs: ExistingDoc[]
  existingNationality: NationalityType | null
  existingFoodSafety: { completed: boolean; date: string | null; provider: string | null } | null
  existingVisa?: { type: VisaType | null; expiryDate: string | null } | null
  /** Phase 41a — pre-fill the foreign-born owner sub-question on the
   *  NationalityScreen so the "Redo compliance check" flow doesn't lose it. */
  existingNaturalisedPre1994?: boolean | null
  /** When set, force-open the modal on mount (e.g. from "Redo compliance check"). */
  forceOpen?: boolean
}

export function DashboardComplianceOnboarding({
  shop,
  preFilledMunicipality,
  existingDocs,
  existingNationality,
  existingFoodSafety,
  existingVisa,
  existingNaturalisedPre1994 = null,
  forceOpen = false,
}: Props) {
  const router = useRouter()
  const showBanner = shouldShowComplianceBanner(shop)
  const autoOpen =
    forceOpen ||
    (!shop.onboarding_compliance_completed &&
      shop.onboarding_compliance_dismiss_count === 0 &&
      !shop.onboarding_compliance_dismissed_at)

  const [open, setOpen] = useState(autoOpen)
  // Hide the banner client-side once it's been opened/dismissed in this session
  // so the user doesn't see both.
  const [bannerHidden, setBannerHidden] = useState(false)

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  const initialDocStates: Partial<Record<OnboardingDocumentType, DocumentToggleState>> = {}
  for (const d of existingDocs) {
    initialDocStates[d.document_type] = documentStatusToToggleState(d.status)
  }

  // Don't render banner once compliance is completed.
  const renderBanner = !shop.onboarding_compliance_completed && showBanner && !bannerHidden && !open

  return (
    <>
      {renderBanner && (
        <OnboardingBanner
          onStart={() => {
            setBannerHidden(true)
            setOpen(true)
          }}
        />
      )}
      <ComplianceOnboardingModal
        open={open}
        onClose={() => setOpen(false)}
        onCompleted={() => {
          // Refresh server data so the banner / auto-open logic reflects the new state.
          router.refresh()
        }}
        preFilledMunicipality={preFilledMunicipality}
        initialDocumentStates={initialDocStates}
        initialNationality={existingNationality}
        initialFoodSafety={existingFoodSafety ?? undefined}
        initialVisa={existingVisa ?? undefined}
        initialNaturalisedPre1994={existingNaturalisedPre1994}
      />
    </>
  )
}
