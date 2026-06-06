import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAuthClaims } from '@/lib/auth/claims'
import { ToastProvider } from '@/components/Toast'
import { LanguageProvider } from '@/components/LanguageProvider'
import { AppChrome } from '@/components/AppChrome'
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
  'compliance-reminders', 'sales-statistics', 'guide',
]

/**
 * (app) shell layout — Phase 44 App Shell (Stage 2).
 *
 * The rendered HTML is now DATA-FREE per locale: it carries NO per-shop / per-
 * user data (shop name, person name, role-specific nav all moved to the client
 * <AppChrome>). That's what lets the service worker cache + serve `/sale` (and
 * future shell routes) instantly on a cold open without leaking one shop's data
 * to another (BUG-040). The only thing that varies the HTML is the LOCALE (the
 * baked translation namespaces) — the SW caches shell docs PER-LOCALE keyed off
 * the mvs_locale cookie, so each language still gets its correct copy with no
 * flash.
 *
 * The authoritative SECURITY remains SERVER-SIDE here (the network path): the
 * auth gate + the teller-lockout redirect. <AppChrome> re-checks both client-
 * side purely as a safety net for the SW-cached-serve path (where this never
 * runs). RLS is the real data boundary throughout.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const cookieStore = await cookies()
  const cookieLocale = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value)
  const speculativeLocale: SupportedLocale = cookieLocale ?? DEFAULT_LOCALE

  // Local JWT verify (no network once asymmetric keys are on) in parallel with
  // i18n (local files). (BUG-049)
  const [claims, initialNsMap] = await Promise.all([
    getAuthClaims(supabase),
    loadNamespacedTranslations(speculativeLocale, APP_SHELL_NAMESPACES),
  ])

  if (!claims) redirect('/login')

  const role = (claims.appMetadata.role as string) ?? 'owner'
  const shopId = claims.appMetadata.shop_id as string | undefined

  let initialLocale: SupportedLocale = speculativeLocale

  if (shopId) {
    // React.cache-memoised — reused by the dashboard readers downstream.
    const shopRow = await getShopForRequest(shopId, supabase)

    // Teller lockout for an expired shop (authoritative, server/network path).
    // Decided from the LIVE shop row (a teller's JWT can't be trusted for sub
    // state). /shop-suspended sits OUTSIDE this group → no redirect loop
    // (BUG-047). Fail open if the row is missing. <AppChrome> mirrors this
    // client-side for the SW-cached-serve path. This is a redirect DECISION —
    // it bakes NO data into the HTML, so the shell stays cacheable.
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

    const resolvedShopLocale = parseLocale(shopRow?.language ?? undefined)
    if (resolvedShopLocale && resolvedShopLocale !== speculativeLocale) {
      initialLocale = resolvedShopLocale
    }
  }

  const finalNsMap =
    initialLocale === speculativeLocale
      ? initialNsMap
      : await loadNamespacedTranslations(initialLocale, APP_SHELL_NAMESPACES)

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
          <AppChrome>{children}</AppChrome>
        </ToastProvider>
      </LanguageProvider>
    </div>
  )
}
