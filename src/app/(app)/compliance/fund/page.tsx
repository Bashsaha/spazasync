/**
 * Phase 37e — Fund Readiness Checker.
 *
 * Owner-only. Doubly gated: layout.tsx blocks tellers; the composite
 * reader returns null (→ redirect) if the owner is not an SA citizen
 * or did not opt in to fund_interest.
 */

import { redirect } from 'next/navigation'
import { BackButton } from '@/components/BackButton'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getFundReadinessData } from '@/lib/db/fund-readiness'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'
import { FundHeroStatus } from '@/components/compliance-fund/FundHeroStatus'
import { EligibilitySection } from '@/components/compliance-fund/EligibilitySection'
import { DocumentReadiness } from '@/components/compliance-fund/DocumentReadiness'
import { ComplianceReadiness } from '@/components/compliance-fund/ComplianceReadiness'
import { FundBreakdown } from '@/components/compliance-fund/FundBreakdown'
import { FundTierLadder } from '@/components/compliance-fund/FundTierLadder'
import { PrioritySelfDeclaration } from '@/components/compliance-fund/PrioritySelfDeclaration'
import { SarsGraceCountdown } from '@/components/compliance-fund/SarsGraceCountdown'
import { GenerateApplicationPackButton } from '@/components/compliance-fund/GenerateApplicationPackButton'
import { ApplySection } from '@/components/compliance-fund/ApplySection'

export const dynamic = 'force-dynamic'

export default async function FundReadinessPage() {
  const auth = await getShopAuth()
  if (!auth) redirect('/login')

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') redirect('/sale')

  const data = await getFundReadinessData(auth.shopId, auth.user.id)
  // Reader returns null when the owner is not an SA citizen, has fund_interest=false,
  // or the owner_profile row is missing — in all cases, push them back to the journey.
  if (!data) redirect('/compliance/journey')

  const locale = await getServerLocale()
  const { t } = await getServerTranslations(locale, ['compliance-fund'])

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <BackButton fallbackHref="/compliance/journey" />
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">{t('subtitle')}</p>

      <FundHeroStatus
        status={data.fundReadiness.status}
        missingCount={data.fundReadiness.missingDocCount}
        t={t}
      />

      {/* Phase 41d — visualises the SARS 6-month grace window (Phase 41a
          stored the date but never surfaced it to the owner). Renders only
          when SARS is currently being treated as ok via the grace branch. */}
      <SarsGraceCountdown
        sarsGracePeriodUntil={data.shop.sars_grace_period_until}
        sarsInGracePeriod={data.fundReadiness.sarsInGracePeriod}
        t={t}
      />

      <EligibilitySection
        initialTownshipRural={data.shop.fund_township_rural}
        initialOwnerManaged={data.shop.fund_owner_managed}
        initialHasDisability={data.ownerProfile.has_disability}
      />

      <DocumentReadiness
        rows={data.fundReadiness.requiredDocs}
        documents={data.documents}
        t={t}
      />

      <ComplianceReadiness result={data.complianceScoreResult} t={t} />

      {/* Phase 41b — new visual tier ladder makes the R80k CIPC threshold
          unmissable. Keep FundBreakdown below it for the detailed line-item
          breakdown of each tier's components. */}
      <FundTierLadder cipcRegistered={data.fundReadiness.cipcRegistered} t={t} />

      <FundBreakdown cipcRegistered={data.fundReadiness.cipcRegistered} t={t} />

      {/* Phase 41b — youth + women-owned self-declaration. UI-only per
          Design Rule 6; surfaces a reminder to flag priority on the
          SEDFA application. */}
      <PrioritySelfDeclaration />

      <GenerateApplicationPackButton missingDocCount={data.fundReadiness.missingDocCount} />

      <ApplySection t={t} />
    </main>
  )
}
