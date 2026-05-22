/**
 * Phase 37c — Compliance Journey Hub.
 *
 * Server component. Fetches the composite journey payload via getJourneyData()
 * (single round trip), then renders:
 *   1. Header with back link + title + subtitle
 *   2. JourneyProgress card (X of Y done + next step + optional fund teaser)
 *   3. The 5–7 visible step cards in dependency order
 *
 * The first non-complete step is auto-expanded; everything else is collapsed
 * by default so the page stays scrollable on a phone.
 */

import { redirect } from 'next/navigation'
import { BackButton } from '@/components/BackButton'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getJourneyData } from '@/lib/db/journey'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'
import { JourneyProgress } from '@/components/compliance-journey/JourneyProgress'
import { JourneyStep } from '@/components/compliance-journey/JourneyStep'
import { NextStepHero } from '@/components/compliance-journey/NextStepHero'
import { VisaPermitWarning } from '@/components/compliance-journey/VisaPermitWarning'
import { TradingPermitStep } from '@/components/compliance-journey/steps/TradingPermitStep'
import { HealthCertificateStep } from '@/components/compliance-journey/steps/HealthCertificateStep'
import { CIPCStep } from '@/components/compliance-journey/steps/CIPCStep'
import { SARSStep } from '@/components/compliance-journey/steps/SARSStep'
import { UIFStep } from '@/components/compliance-journey/steps/UIFStep'
import { FoodSafetyStep } from '@/components/compliance-journey/steps/FoodSafetyStep'
import { SMMESAStep } from '@/components/compliance-journey/steps/SMMESAStep'
import { RightToTradeStep } from '@/components/compliance-journey/steps/RightToTradeStep'
import { qualifiesAsSaCitizenForFund } from '@/lib/compliance/fund'
import type { ComplianceJourneyStep } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ComplianceJourneyPage() {
  const auth = await getShopAuth()
  if (!auth) redirect('/login')

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') redirect('/sale')

  const data = await getJourneyData(auth.shopId, auth.user.id)
  if (!data) redirect('/dashboard')

  const locale = await getServerLocale()
  const { t } = await getServerTranslations(locale, ['compliance-journey'])
  const { t: tInsp } = await getServerTranslations(locale, ['inspection'])

  const currentStepKey =
    data.steps.find((s) => s.status !== 'complete')?.key ?? null

  // "Counts as an SA citizen for the fund" = sa_citizen OR foreign-born owner
  // naturalised before 1994. The latter are SA citizens by law, so they get the
  // citizen journey (SA ID, BizPortal, fund teaser) — NOT the foreign path.
  const treatedAsCitizen = qualifiesAsSaCitizenForFund(
    data.ownerProfile ?? { nationality_type: null },
  )
  const showFundTeaser = treatedAsCitizen && data.shop.fund_interest

  // True foreign national = foreign_national who is NOT pre-1994 naturalised.
  // Drives every passport/visa swap + eServices-instead-of-BizPortal routing.
  const isForeignNational =
    data.ownerProfile?.nationality_type === 'foreign_national' && !treatedAsCitizen
  const visaExpiry = data.ownerProfile?.visa_expiry_date ?? null
  const daysRemaining = computeDaysRemaining(visaExpiry)

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <BackButton fallbackHref="/profile" />
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">{t('subtitle')}</p>

      {isForeignNational && (
        <VisaPermitWarning
          t={t}
          visaType={data.ownerProfile?.visa_type ?? null}
          visaExpiryDate={visaExpiry}
          daysRemaining={daysRemaining}
        />
      )}

      <NextStepHero steps={data.steps} t={t} isForeignNational={isForeignNational} />

      <JourneyProgress steps={data.steps} t={t} showFundTeaser={showFundTeaser} />

      <div>
        {data.steps.map((step) => (
          <JourneyStep
            key={step.key}
            id={`step-${step.key}`}
            step={step}
            defaultExpanded={step.key === currentStepKey}
            isForeignNational={isForeignNational}
          >
            {renderStepBody(step, data, t, tInsp, isForeignNational)}
          </JourneyStep>
        ))}
      </div>

      {/* Lightweight POPIA awareness note */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mt-4 mb-8">
        <p className="text-xs font-semibold text-blue-800 mb-1">{t('popia_title')}</p>
        <p className="text-xs text-blue-700 leading-relaxed">{t('popia_body')}</p>
      </div>
    </main>
  )
}

/**
 * Days between today (UTC) and the expiry date (parsed as YYYY-MM-DD UTC).
 * Returns null when no expiry is on file. Negative when already expired.
 * Day-precision math is fine here — the user only sees a coarse countdown.
 */
function computeDaysRemaining(expiry: string | null): number | null {
  if (!expiry) return null
  const expiryMs = Date.parse(`${expiry}T00:00:00Z`)
  if (Number.isNaN(expiryMs)) return null
  const todayMs = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.round((expiryMs - todayMs) / (24 * 60 * 60 * 1000))
}

function renderStepBody(
  step: ComplianceJourneyStep,
  data: Awaited<ReturnType<typeof getJourneyData>>,
  t: (key: string, params?: Record<string, string | number>) => string,
  tInsp: (key: string, params?: Record<string, string | number>) => string,
  isForeignNational: boolean,
) {
  if (!data) return null
  switch (step.key) {
    case 'right_to_trade':
      return (
        <RightToTradeStep
          t={t}
          visaType={data.ownerProfile?.visa_type ?? null}
          visaExpiryDate={data.ownerProfile?.visa_expiry_date ?? null}
          daysRemaining={computeDaysRemaining(data.ownerProfile?.visa_expiry_date ?? null)}
        />
      )
    case 'municipal_registration':
      return <TradingPermitStep step={step} data={data} t={t} isForeignNational={isForeignNational} />
    case 'coa':
      return <HealthCertificateStep step={step} data={data} t={t} tInsp={tInsp} isForeignNational={isForeignNational} />
    case 'cipc':
      return <CIPCStep step={step} data={data} t={t} isForeignNational={isForeignNational} />
    case 'sars_tax':
      return <SARSStep step={step} data={data} t={t} isForeignNational={isForeignNational} />
    case 'uif':
      return <UIFStep step={step} t={t} isForeignNational={isForeignNational} />
    case 'food_safety_training':
      return <FoodSafetyStep step={step} data={data} t={t} />
    case 'smmesa':
      return <SMMESAStep step={step} t={t} />
  }
}
