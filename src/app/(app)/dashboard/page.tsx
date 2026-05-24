import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Skeleton } from '@/components/Skeleton'
import { TodaySummary } from '@/components/dashboard/TodaySummary'
import { LowStockAlert } from '@/components/dashboard/LowStockAlert'
import { ExpiringAlert } from '@/components/dashboard/ExpiringAlert'
import { LatestSales } from '@/components/dashboard/LatestSales'
import { DashboardAutoRefresh } from '@/components/dashboard/DashboardAutoRefresh'
import { ComplianceCard } from '@/components/dashboard/ComplianceCard'
import { JourneyProgressCard } from '@/components/dashboard/JourneyProgressCard'
import { DashboardComplianceOnboarding } from '@/components/compliance-onboarding/DashboardComplianceOnboarding'
import { getShopForRequest } from '@/lib/db/shop'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'
import type { DocumentStatus, NationalityType, OnboardingDocumentType } from '@/types'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ redo_compliance?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const sp = (await searchParams) ?? {}
  const forceComplianceModal = sp.redo_compliance === '1'

  // Trust the role + shop_id baked into the JWT by the middleware — saves a
  // shop_users round trip. Then fire shop + owner-profile data in parallel.
  // Previously: shop_users query (blocks) → 3 parallel queries = 2 sequential RTTs.
  // Now: shop + docs + profile in one parallel batch = 1 RTT (then optional
  // municipality lookup if the shop has one set).
  //
  // `isOwnerUI` deliberately treats dual-role admins (admins promoted from
  // owners via scripts/set-admin.ts) the same as regular owners: they keep
  // shop_id + their shop_users row with role='owner', so they expect the full
  // owner dashboard (BUG-029 / BUG-039 follow-up). The previous code derived
  // role from shop_users.role, which papered over the distinction; the JWT
  // role we use now does not, so we have to gate on shopId + !teller instead.
  const role = user.app_metadata?.role as 'owner' | 'teller' | 'admin' | undefined
  const shopIdMeta = user.app_metadata?.shop_id as string | undefined
  const isOwnerUI = !!shopIdMeta && role !== 'teller'

  type Shop = {
    id: string
    name: string
    code: string
    low_stock_threshold: number
    subscription_status: string
    trial_ends_at: string | null
    subscription_ends_at: string | null
    profit_tracking_enabled: boolean
    municipality_id: string | null
    onboarding_compliance_completed: boolean
    onboarding_compliance_dismissed_at: string | null
    onboarding_compliance_dismiss_count: number
  }

  let shop: Shop | null = null
  let existingDocs: { document_type: OnboardingDocumentType; status: DocumentStatus }[] = []
  let existingNationality: NationalityType | null = null
  let existingFoodSafety:
    | { completed: boolean; date: string | null; provider: string | null }
    | null = null
  let existingVisa:
    | { type: import('@/types').VisaType | null; expiryDate: string | null }
    | null = null
  let existingNaturalisedPre1994: boolean | null = null
  let preFilledMunicipality: { id: string; name: string } | null = null

  if (shopIdMeta) {
    // getShopForRequest is React.cache-memoised at the layout call site —
    // this hit reuses that result for free (zero DB call).
    const [shopRow, docsRes, profileRes] = await Promise.all([
      getShopForRequest(shopIdMeta, supabase),
      isOwnerUI
        ? supabase
            .from('business_documents')
            .select('document_type, status')
            .in('document_type', ['municipal_registration', 'coa', 'cipc', 'sars_tax', 'uif'])
        : Promise.resolve({ data: null }),
      isOwnerUI
        ? supabase
            .from('owner_profiles')
            .select(
              'nationality_type, food_safety_training_completed, food_safety_training_date, food_safety_training_provider, visa_type, visa_expiry_date, naturalised_pre_1994',
            )
            .eq('user_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    shop = (shopRow as Shop | null) ?? null

    if (isOwnerUI) {
      existingDocs = (docsRes.data ?? []) as typeof existingDocs

      const profile = profileRes.data as
        | {
            nationality_type: NationalityType | null
            food_safety_training_completed: boolean | null
            food_safety_training_date: string | null
            food_safety_training_provider: string | null
            visa_type: import('@/types').VisaType | null
            visa_expiry_date: string | null
            naturalised_pre_1994: boolean | null
          }
        | null
      if (profile) {
        existingNationality = profile.nationality_type ?? null
        existingFoodSafety = {
          completed: Boolean(profile.food_safety_training_completed),
          date: profile.food_safety_training_date,
          provider: profile.food_safety_training_provider,
        }
        existingVisa = {
          type: profile.visa_type ?? null,
          expiryDate: profile.visa_expiry_date ?? null,
        }
        existingNaturalisedPre1994 = profile.naturalised_pre_1994 ?? null
      }

      // Only the municipality name depends on shop.municipality_id, so we
      // wait until after the parallel batch resolves to fire it (and skip
      // entirely if no municipality is set).
      if (shop?.municipality_id) {
        const { data: m } = await supabase
          .from('municipalities')
          .select('id, name')
          .eq('id', shop.municipality_id)
          .maybeSingle()
        if (m) preFilledMunicipality = { id: m.id as string, name: m.name as string }
      }
    }
  }

  const shopName = shop?.name ?? 'Your Shop'
  const shopCode = shop?.code ?? ''

  const locale = await getServerLocale()
  const { t, tPlural } = await getServerTranslations(locale, ['dashboard'])

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
      {/* Re-pulls server data after a sale (or any mutation) without a reload;
          also live-refreshes when a sale is recorded on another device. */}
      <DashboardAutoRefresh shopId={shopIdMeta} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{shopName}</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {t('staff_login_code')}{' '}
          <span className="font-mono font-semibold text-brand">{shopCode}</span>
          <span className="text-xs text-gray-400 ml-1">{t('staff_login_hint')}</span>
        </p>
      </div>

      {/* Subscription warning banner */}
      {(() => {
        const endDate = shop?.subscription_status === 'trialing'
          ? shop?.trial_ends_at
          : shop?.subscription_status === 'cancelled'
            ? shop?.subscription_ends_at
            : null
        if (!endDate) return null
        const daysLeft = Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
        if (daysLeft > 3) return null
        const labelKey = shop?.subscription_status === 'trialing' ? 'sub_free_trial' : 'sub_subscription'
        const label = t(labelKey)
        return (
          <a
            href="/subscribe"
            className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4"
          >
            <p className="text-sm font-semibold text-amber-800">
              {daysLeft === 0
                ? t('sub_ended', { label })
                : tPlural('sub_ending', daysLeft, { label, count: daysLeft })}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              {t('sub_tap_subscribe')}
            </p>
          </a>
        )
      })()}

      {/* Compliance onboarding banner + modal (owners only, Phase 37b). */}
      {/* Phase 37g smart reminders moved to the notification bell — see
          NotificationBell.tsx for the full list rendered there. */}
      {isOwnerUI && shop?.id && (
        <DashboardComplianceOnboarding
          shop={{
            onboarding_compliance_completed: shop.onboarding_compliance_completed,
            onboarding_compliance_dismissed_at: shop.onboarding_compliance_dismissed_at,
            onboarding_compliance_dismiss_count: shop.onboarding_compliance_dismiss_count,
          }}
          preFilledMunicipality={preFilledMunicipality}
          existingDocs={existingDocs}
          existingNationality={existingNationality}
          existingFoodSafety={existingFoodSafety}
          existingVisa={existingVisa}
          existingNaturalisedPre1994={existingNaturalisedPre1994}
          forceOpen={forceComplianceModal}
        />
      )}

      {/* Unified compliance card — score + alerts OR all-clear with PDF link. Always present. */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-24 rounded-2xl mb-4" />}>
          <ComplianceCard shopId={shop.id} locale={locale} />
        </Suspense>
      )}

      {/* Phase 37c — Journey progress card. Owners only; the JourneyProgressCard returns
          null for non-owners and for shops without journey state. */}
      {isOwnerUI && shop?.id && (
        <Suspense fallback={<Skeleton className="h-24 rounded-2xl mb-4" />}>
          <JourneyProgressCard shopId={shop.id} userId={user.id} locale={locale} />
        </Suspense>
      )}

      {/* Today's summary — streams in */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-24 rounded-2xl mb-4" />}>
          <TodaySummary
            shopId={shop.id}
            locale={locale}
            profitTrackingEnabled={Boolean(shop.profit_tracking_enabled)}
          />
        </Suspense>
      )}

      {/* Low stock alert — streams in, returns null when nothing's low */}
      {shop?.id && (
        <Suspense fallback={null}>
          <LowStockAlert shopId={shop.id} threshold={shop.low_stock_threshold} locale={locale} />
        </Suspense>
      )}

      {/* Expiring products alert — streams in, returns null when nothing's expiring */}
      {shop?.id && (
        <Suspense fallback={null}>
          <ExpiringAlert shopId={shop.id} locale={locale} />
        </Suspense>
      )}

      {/* Latest sales (with "See all →" link to /sales/history) */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-40 rounded-2xl mb-4" />}>
          <LatestSales shopId={shop.id} locale={locale} />
        </Suspense>
      )}
    </main>
  )
}
