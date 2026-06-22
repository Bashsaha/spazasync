'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCachedData } from '@/hooks/useCachedData'
import { useTranslation } from '@/components/LanguageProvider'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/Skeleton'
import { DashboardSummaryCards } from '@/components/dashboard/DashboardSummaryCards'
import { DashboardRealtime } from '@/components/dashboard/DashboardRealtime'
import { ComplianceCardView, type ComplianceCardData } from '@/components/dashboard/ComplianceCardView'
import { JourneyProgressCardView, type JourneyCardData } from '@/components/dashboard/JourneyProgressCardView'
import { LatestSalesView } from '@/components/dashboard/LatestSalesView'
import { DashboardComplianceOnboarding } from '@/components/compliance-onboarding/DashboardComplianceOnboarding'
import type {
  RecentSale,
  DocumentStatus,
  NationalityType,
  OnboardingDocumentType,
  VisaType,
} from '@/types'

/**
 * Owner dashboard — Phase 44 App Shell. Fully DATA-FREE + client cache-first:
 * the whole page reads one cached `/api/dashboard` snapshot, so its HTML is
 * SW-cacheable (instant cold open like /sale) and it never server-renders into a
 * sleeping radio on resume (the proper fix for BUG-051). Owner/admin only —
 * middleware bounces tellers to /sale.
 */

const EMPTY_SALES: RecentSale[] = []

type DashboardPayload = {
  shop: {
    name: string | null
    code: string
    subscription_status: string | null
    trial_ends_at: string | null
    subscription_ends_at: string | null
    profit_tracking_enabled: boolean
    onboarding_compliance_completed: boolean
    onboarding_compliance_dismissed_at: string | null
    onboarding_compliance_dismiss_count: number
  } | null
  compliance: ComplianceCardData | null
  journey: JourneyCardData | null
  latestSales: RecentSale[]
  onboarding: {
    docs: { document_type: OnboardingDocumentType; status: DocumentStatus }[]
    nationality: NationalityType | null
    foodSafety: { completed: boolean; date: string | null; provider: string | null } | null
    visa: { type: VisaType | null; expiryDate: string | null } | null
    naturalised: boolean | null
    municipality: { id: string; name: string } | null
  }
}

export default function DashboardPage() {
  const { t, tPlural } = useTranslation('dashboard')
  const searchParams = useSearchParams()
  const forceComplianceModal = searchParams.get('redo_compliance') === '1'

  // shopId for the realtime cross-device refresh (local JWT read, no network).
  const [shopId, setShopId] = useState<string | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await createClient().auth.getSession()
        if (!cancelled) {
          setShopId((data.session?.user.app_metadata?.shop_id as string | undefined) ?? undefined)
        }
      } catch {
        /* ignore — realtime just won't subscribe */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const { data, loading } = useCachedData<DashboardPayload>('dashboard', () =>
    fetch('/api/dashboard', { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error('load failed')
      return r.json() as Promise<DashboardPayload>
    }),
  )

  const shop = data?.shop ?? null
  const shopName = shop?.name || 'Your Shop'
  const shopCode = shop?.code ?? ''

  // Subscription warning banner (≤3 days left on a trial / cancelled sub).
  const endDate =
    shop?.subscription_status === 'trialing'
      ? shop?.trial_ends_at
      : shop?.subscription_status === 'cancelled' ||
          shop?.subscription_status === 'processing_cancellation'
        ? shop?.subscription_ends_at
        : null
  const daysLeft = endDate
    ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null
  const showSubBanner = daysLeft !== null && daysLeft <= 3
  const subLabel = t(shop?.subscription_status === 'trialing' ? 'sub_free_trial' : 'sub_subscription')

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      {/* Cross-device live refresh (a teller's sale on another device). */}
      <DashboardRealtime shopId={shopId} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{shopName}</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {t('staff_login_code')}{' '}
          <span className="font-mono font-semibold text-brand">{shopCode}</span>
          <span className="text-xs text-gray-400 ml-1">{t('staff_login_hint')}</span>
        </p>
      </div>

      {showSubBanner && (
        <a href="/subscribe" className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-amber-800">
            {daysLeft === 0
              ? t('sub_ended', { label: subLabel })
              : tPlural('sub_ending', daysLeft as number, { label: subLabel, count: daysLeft as number })}
          </p>
          <p className="text-xs text-amber-600 mt-1">{t('sub_tap_subscribe')}</p>
        </a>
      )}

      {/* Compliance onboarding banner + modal (owners). */}
      {shop && (
        <DashboardComplianceOnboarding
          shop={{
            onboarding_compliance_completed: shop.onboarding_compliance_completed,
            onboarding_compliance_dismissed_at: shop.onboarding_compliance_dismissed_at,
            onboarding_compliance_dismiss_count: shop.onboarding_compliance_dismiss_count,
          }}
          preFilledMunicipality={data?.onboarding.municipality ?? null}
          existingDocs={data?.onboarding.docs ?? []}
          existingNationality={data?.onboarding.nationality ?? null}
          existingFoodSafety={data?.onboarding.foodSafety ?? null}
          existingVisa={data?.onboarding.visa ?? null}
          existingNaturalisedPre1994={data?.onboarding.naturalised ?? null}
          forceOpen={forceComplianceModal}
        />
      )}

      {/* First-ever load with no snapshot: a couple of card skeletons. */}
      {loading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : (
        <>
          {data?.compliance && <ComplianceCardView data={data.compliance} />}
          {data?.journey && <JourneyProgressCardView data={data.journey} />}
          <DashboardSummaryCards />
          <LatestSalesView sales={data?.latestSales ?? EMPTY_SALES} />
        </>
      )}
    </main>
  )
}
