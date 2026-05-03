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

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getJourneyData } from '@/lib/db/journey'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'
import { JourneyProgress } from '@/components/compliance-journey/JourneyProgress'
import { JourneyStep } from '@/components/compliance-journey/JourneyStep'
import { TradingPermitStep } from '@/components/compliance-journey/steps/TradingPermitStep'
import { HealthCertificateStep } from '@/components/compliance-journey/steps/HealthCertificateStep'
import { CIPCStep } from '@/components/compliance-journey/steps/CIPCStep'
import { SARSStep } from '@/components/compliance-journey/steps/SARSStep'
import { UIFStep } from '@/components/compliance-journey/steps/UIFStep'
import { FoodSafetyStep } from '@/components/compliance-journey/steps/FoodSafetyStep'
import { SMMESAStep } from '@/components/compliance-journey/steps/SMMESAStep'
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

  const showFundTeaser =
    data.ownerProfile?.nationality_type === 'sa_citizen' && data.shop.fund_interest

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard" className="text-gray-400 active:text-gray-600 text-sm">
          {t('back')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">{t('subtitle')}</p>

      <JourneyProgress steps={data.steps} t={t} showFundTeaser={showFundTeaser} />

      <div>
        {data.steps.map((step) => (
          <JourneyStep
            key={step.key}
            step={step}
            t={t}
            defaultExpanded={step.key === currentStepKey}
          >
            {renderStepBody(step, data, t, tInsp)}
          </JourneyStep>
        ))}
      </div>
    </main>
  )
}

function renderStepBody(
  step: ComplianceJourneyStep,
  data: Awaited<ReturnType<typeof getJourneyData>>,
  t: (key: string, params?: Record<string, string | number>) => string,
  tInsp: (key: string, params?: Record<string, string | number>) => string,
) {
  if (!data) return null
  switch (step.key) {
    case 'municipal_registration':
      return <TradingPermitStep step={step} data={data} t={t} />
    case 'coa':
      return <HealthCertificateStep step={step} data={data} t={t} tInsp={tInsp} />
    case 'cipc':
      return <CIPCStep step={step} data={data} t={t} />
    case 'sars_tax':
      return <SARSStep step={step} data={data} t={t} />
    case 'uif':
      return <UIFStep step={step} t={t} />
    case 'food_safety_training':
      return <FoodSafetyStep step={step} data={data} t={t} />
    case 'smmesa':
      return <SMMESAStep step={step} t={t} />
  }
}
