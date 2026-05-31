import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAuthClaims } from '@/lib/auth/claims'
import { OfflineSyncProvider } from '@/components/OfflineSyncProvider'
import { ToastProvider } from '@/components/Toast'
import { LanguageProvider } from '@/components/LanguageProvider'
import { BottomNav } from '@/components/BottomNav'
import { TopAppBar } from '@/components/TopAppBar'
import DailySummaryAlert from '@/components/DailySummaryAlert'
import { InstallPwaButton } from '@/components/InstallPwaButton'
import { ChecklistReminderFab } from '@/components/ChecklistReminderFab'
import { SaleDataWarmup } from '@/components/SaleDataWarmup'
import { ResumeGuard } from '@/components/ResumeGuard'
import { getTodayChecklist, todaySAST } from '@/lib/db/daily-checklist'
import { getShopForRequest } from '@/lib/db/shop'
import { isSubscriptionExpired, subscriptionEndDate } from '@/lib/subscription/expiry'
import type { SupportedLocale, TranslationNamespace } from '@/lib/i18n/types'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/lib/i18n/types'
import { loadNamespacedTranslations } from '@/lib/i18n/loader'
import { LOCALE_COOKIE, parseLocale } from '@/lib/i18n/locale-cookie'

const APP_SHELL_NAMESPACES: TranslationNamespace[] = [
  'common', 'sale', 'sales', 'dashboard', 'stock', 'stock-loss', 'summary',
  'products', 'tellers', 'expiry', 'settings', 'suppliers', 'checklist',
  'documents', 'waste-pest', 'inspection', 'inventory', 'manage',
  'compliance-onboarding', 'compliance-journey', 'compliance-fund',
  'compliance-reminders', 'sales-statistics',
]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // Resolve locale BEFORE any awaits: cookie is synchronous, so we can fire
  // i18n in parallel with the auth + shop queries below. Falls back to the
  // shop's stored language after the parallel batch lands if the cookie is
  // missing (one extra cheap reconcile load for users who haven't picked a
  // language yet — the LanguageProvider then writes the cookie client-side
  // so subsequent loads stay on the fast path).
  const cookieStore = await cookies()
  const cookieLocale = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value)
  const speculativeLocale: SupportedLocale = cookieLocale ?? DEFAULT_LOCALE

  // Fire EVERYTHING in parallel from the start. getAuthClaims verifies the JWT
  // LOCALLY (no network) once asymmetric signing keys are enabled — so a valid
  // token renders the shell instantly even when the radio is still waking on
  // resume, instead of hanging/throwing like the old auth.getUser() network
  // call did. Translations only depend on locale, so they run in parallel.
  // (BUG-049 — see lib/auth/claims.ts.)
  const [claims, initialNsMap] = await Promise.all([
    getAuthClaims(supabase),
    loadNamespacedTranslations(speculativeLocale, APP_SHELL_NAMESPACES),
  ])

  if (!claims) redirect('/login')

  const role = (claims.appMetadata.role as string) ?? 'owner'
  const shopId = claims.appMetadata.shop_id as string | undefined

  let initialLocale: SupportedLocale = speculativeLocale
  let shopName = 'Movestock'
  let personName: string | null = null
  let showChecklistReminder = false

  if (shopId) {
    const needsChecklist = role === 'owner' || role === 'admin'
    // getShopForRequest is React.cache-memoised so this read is reused by
    // every server component below (dashboard page, JourneyProgressCard,
    // reminders composite reader) — one DB call serves the whole render.
    const [shopRow, tellerRes, checklistRes] = await Promise.all([
      getShopForRequest(shopId, supabase),
      supabase
        .from('tellers')
        .select('name')
        .eq('user_id', claims.id)
        .eq('shop_id', shopId)
        .maybeSingle()
        // Degrade to a nameless shell on a transient network failure rather
        // than crashing the whole (app) render on resume. (BUG-049)
        .then((r) => r, () => ({ data: null as { name?: string } | null })),
      needsChecklist
        ? getTodayChecklist(shopId, todaySAST()).catch(() => null)
        : Promise.resolve(null),
    ])

    if (shopRow?.name) shopName = shopRow.name
    personName = (tellerRes.data?.name as string | undefined) ?? null
    if (needsChecklist) showChecklistReminder = checklistRes === null

    // Teller lockout for an expired shop. A teller's JWT doesn't carry the
    // shop's subscription state, so we decide from the LIVE shop row (read
    // for free via the React.cache'd getShopForRequest above — no extra
    // query) using the SAME helper the owner gate uses. /shop-suspended sits
    // OUTSIDE this (app) route group, so redirecting there does NOT re-enter
    // this layout — no loop (BUG-047). Fail open if the row is missing so a
    // transient read can't lock out a paid teller; /shop-suspended re-checks.
    if (role === 'teller' && shopRow) {
      const expired = isSubscriptionExpired({
        status: shopRow.subscription_status,
        subUntil: subscriptionEndDate(
          shopRow.subscription_status,
          shopRow.trial_ends_at,
          shopRow.subscription_ends_at,
        ),
        accessGranted: shopRow.access_granted,
      })
      if (expired) redirect('/shop-suspended')
    }

    // Reconcile speculative locale against the shop's stored language. If the
    // cookie was missing or didn't match, do a second fast i18n load for the
    // real locale. For users with the cookie set (the steady state), this is
    // a no-op — speculativeLocale already equals shop.language.
    const resolvedShopLocale = parseLocale(shopRow?.language ?? undefined)
    if (resolvedShopLocale && resolvedShopLocale !== speculativeLocale) {
      initialLocale = resolvedShopLocale
    }
  }

  // Second-pass i18n load ONLY if the speculative locale was wrong. The
  // loader's per-(locale,ns) memoisation makes this cheap on subsequent
  // requests after the first cold start.
  const finalNsMap =
    initialLocale === speculativeLocale
      ? initialNsMap
      : await loadNamespacedTranslations(initialLocale, APP_SHELL_NAMESPACES)

  const initialChar = (personName ?? shopName).trim().charAt(0).toUpperCase()
  const initial = initialChar || 'M'

  // Sanity check: only emit a supported locale to the client.
  const safeLocale: SupportedLocale = SUPPORTED_LOCALES.includes(initialLocale)
    ? initialLocale
    : DEFAULT_LOCALE

  return (
    <div className="min-h-screen bg-surface">
      <LanguageProvider
        initialLocale={safeLocale}
        namespaces={APP_SHELL_NAMESPACES}
        initialNsMap={finalNsMap}
      >
        <ToastProvider>
          {/* Refreshes the session + confirms connectivity on resume BEFORE any
              passive data refresh fires — kills the resume-from-background crash
              / "tab won't load" (BUG-049). Mounted for every app user. */}
          <ResumeGuard />
          <TopAppBar
            title={shopName}
            subtitle={personName ?? undefined}
            initial={initial}
            bellShopId={role === 'owner' || role === 'admin' ? shopId : undefined}
          />
          <InstallPwaButton />
          {role !== 'teller' && <DailySummaryAlert />}
          <OfflineSyncProvider>
            {children}
          </OfflineSyncProvider>
          <BottomNav role={role} hasShop={!!shopId} />
          {(role === 'owner' || role === 'admin') && shopId && (
            <ChecklistReminderFab initialVisible={showChecklistReminder} />
          )}
          {shopId && <SaleDataWarmup />}
        </ToastProvider>
      </LanguageProvider>
    </div>
  )
}
