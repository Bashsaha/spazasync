/**
 * Phase 37e — Fund Readiness Checker.
 * Phase 50 — IA + copy redesign. The page now leads with one dominant
 * "Your route to qualifying" hero that ties fund eligibility directly to
 * finishing the compliance journey, keeps the actionable bits (documents,
 * application pack) visible, and folds the dense reference content
 * (eligibility, funding tiers, how-to-apply) behind <Disclosure> accordions.
 *
 * Owner-only. Doubly gated: layout.tsx blocks tellers; the composite
 * reader returns null (→ redirect) if the owner is not an SA citizen
 * or did not opt in to fund_interest.
 */

import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { BackButton } from '@/components/BackButton'
import { Callout, Disclosure, Badge } from '@/components/ui'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getFundReadinessData } from '@/lib/db/fund-readiness'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'
import { FundQualifyHero } from '@/components/compliance-fund/FundQualifyHero'
import { SarsGraceCountdown } from '@/components/compliance-fund/SarsGraceCountdown'
import { DocumentReadiness } from '@/components/compliance-fund/DocumentReadiness'
import { EligibilityAndPriority } from '@/components/compliance-fund/EligibilityAndPriority'
import { FundReceiveSection } from '@/components/compliance-fund/FundReceiveSection'
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

  const eligibilityBlocked =
    data.shop.fund_township_rural === false || data.shop.fund_owner_managed === false

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <BackButton fallbackHref="/compliance/journey" />
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">{t('subtitle')}</p>

      {/* HERO — the route to qualifying (verdict + progress + score + CTA) */}
      <FundQualifyHero
        status={data.fundReadiness.status}
        missingCount={data.fundReadiness.missingDocCount}
        requiredDocs={data.fundReadiness.requiredDocs}
        complianceScore={data.complianceScoreResult.overall}
        t={t}
      />

      {/* Time-sensitive SARS grace nudge (only while in the grace window) */}
      <SarsGraceCountdown
        sarsGracePeriodUntil={data.shop.sars_grace_period_until}
        sarsInGracePeriod={data.fundReadiness.sarsInGracePeriod}
        t={t}
      />

      {/* SECONDARY (visible, actionable) — your registrations */}
      <DocumentReadiness
        rows={data.fundReadiness.requiredDocs}
        documents={data.documents}
        t={t}
      />

      {/* REFERENCE (collapsed) — eligibility & priority */}
      <Disclosure
        title={t('eligibility_header')}
        summary={
          <Badge tone={eligibilityBlocked ? 'red' : 'green'}>
            {t(eligibilityBlocked ? 'eligibility_summary_blocked' : 'eligibility_summary_ok')}
          </Badge>
        }
        className="mb-4"
      >
        <EligibilityAndPriority
          initialTownshipRural={data.shop.fund_township_rural}
          initialOwnerManaged={data.shop.fund_owner_managed}
          initialHasDisability={data.ownerProfile.has_disability}
        />
      </Disclosure>

      {/* REFERENCE (collapsed) — what you could receive */}
      <Disclosure title={t('breakdown_header')} className="mb-4">
        <FundReceiveSection cipcRegistered={data.fundReadiness.cipcRegistered} t={t} />
      </Disclosure>

      {/* SECONDARY (visible, actionable) — the payoff button */}
      <GenerateApplicationPackButton missingDocCount={data.fundReadiness.missingDocCount} />

      {/* Persistent fraud warning — never hidden behind a tap */}
      <Callout tone="error" icon={ShieldAlert} title={t('apply_scam_warning_title')} className="mb-4">
        {t('apply_scam_warning_body')}
      </Callout>

      {/* REFERENCE (collapsed) — how to apply */}
      <Disclosure title={t('apply_header')}>
        <ApplySection t={t} />
      </Disclosure>
    </main>
  )
}
