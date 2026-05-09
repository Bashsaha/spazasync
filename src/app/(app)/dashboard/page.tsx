import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Skeleton } from '@/components/Skeleton'
import { TodaySummary } from '@/components/dashboard/TodaySummary'
import { LowStockAlert } from '@/components/dashboard/LowStockAlert'
import { ExpiringAlert } from '@/components/dashboard/ExpiringAlert'
import { LatestSales } from '@/components/dashboard/LatestSales'
import { ComplianceCard } from '@/components/dashboard/ComplianceCard'
import { JourneyProgressCard } from '@/components/dashboard/JourneyProgressCard'
import { DashboardComplianceOnboarding } from '@/components/compliance-onboarding/DashboardComplianceOnboarding'
import { DashboardReminder } from '@/components/compliance-reminders/DashboardReminder'
import { InstallPwaButton } from '@/components/InstallPwaButton'
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

  const { data: shopUser } = await supabase
    .from('shop_users')
    .select(`
      role,
      shops(
        id, name, code, low_stock_threshold, subscription_status, trial_ends_at,
        subscription_ends_at, profit_tracking_enabled,
        municipality_id, onboarding_compliance_completed,
        onboarding_compliance_dismissed_at, onboarding_compliance_dismiss_count
      )
    `)
    .eq('user_id', user.id)
    .single()

  const shop = shopUser?.shops as unknown as {
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
  } | null

  const role = shopUser?.role as 'owner' | 'teller' | 'admin' | undefined

  // Owner-only: pull the bits the compliance onboarding modal pre-populates from.
  let preFilledMunicipality: { id: string; name: string } | null = null
  let existingDocs: { document_type: OnboardingDocumentType; status: DocumentStatus }[] = []
  let existingNationality: NationalityType | null = null
  let existingFoodSafety:
    | { completed: boolean; date: string | null; provider: string | null }
    | null = null
  let existingVisa:
    | { type: import('@/types').VisaType | null; expiryDate: string | null }
    | null = null

  if (role === 'owner' && shop?.id) {
    // Run the three owner-only queries in parallel — none depend on each other.
    const [municipalityRes, docsRes, profileRes] = await Promise.all([
      shop.municipality_id
        ? supabase
            .from('municipalities')
            .select('id, name')
            .eq('id', shop.municipality_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('business_documents')
        .select('document_type, status')
        .in('document_type', ['municipal_registration', 'coa', 'cipc', 'sars_tax', 'uif']),
      supabase
        .from('owner_profiles')
        .select('nationality_type, food_safety_training_completed, food_safety_training_date, food_safety_training_provider, visa_type, visa_expiry_date')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const m = municipalityRes.data
    if (m) preFilledMunicipality = { id: m.id as string, name: m.name as string }

    existingDocs = (docsRes.data ?? []) as typeof existingDocs

    const profile = profileRes.data
    if (profile) {
      existingNationality = (profile.nationality_type as NationalityType | null) ?? null
      existingFoodSafety = {
        completed: Boolean(profile.food_safety_training_completed),
        date: profile.food_safety_training_date as string | null,
        provider: profile.food_safety_training_provider as string | null,
      }
      existingVisa = {
        type: (profile.visa_type as import('@/types').VisaType | null) ?? null,
        expiryDate: (profile.visa_expiry_date as string | null) ?? null,
      }
    }
  }

  const shopName = shop?.name ?? 'Your Shop'
  const shopCode = shop?.code ?? ''

  const locale = await getServerLocale()
  const { t, tPlural } = await getServerTranslations(locale, ['dashboard'])

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
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

      {/* Add-to-home-screen prompt. Self-hides if already installed (PWA standalone),
          if dismissed within the last 7 days, or on browsers that don't fire
          beforeinstallprompt and aren't iOS Safari. */}
      <InstallPwaButton />

      {/* Phase 37g — Smart reminders banner (owners only). Renders the highest-
          priority reminder; null when nothing eligible. Sits above onboarding
          + compliance card so the most-urgent next action is the first thing
          owners see. */}
      {role === 'owner' && shop?.id && (
        <Suspense fallback={null}>
          <DashboardReminder shopId={shop.id} userId={user.id} />
        </Suspense>
      )}

      {/* Compliance onboarding banner + modal (owners only, Phase 37b). */}
      {role === 'owner' && shop?.id && (
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
      {role === 'owner' && shop?.id && (
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
