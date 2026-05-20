import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { OfflineSyncProvider } from '@/components/OfflineSyncProvider'
import { ToastProvider } from '@/components/Toast'
import { LanguageProvider } from '@/components/LanguageProvider'
import { BottomNav } from '@/components/BottomNav'
import { TopAppBar } from '@/components/TopAppBar'
import DailySummaryAlert from '@/components/DailySummaryAlert'
import { InstallPwaButton } from '@/components/InstallPwaButton'
import { ChecklistReminderFab } from '@/components/ChecklistReminderFab'
import { SaleDataWarmup } from '@/components/SaleDataWarmup'
import { getTodayChecklist, todaySAST } from '@/lib/db/daily-checklist'
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

  // Fire EVERYTHING in parallel from the start. auth.getUser is cheap (one
  // RTT) but doesn't gate the i18n load — translations only depend on locale.
  const [userRes, initialNsMap] = await Promise.all([
    supabase.auth.getUser(),
    loadNamespacedTranslations(speculativeLocale, APP_SHELL_NAMESPACES),
  ])

  const user = userRes.data.user
  if (!user) redirect('/login')

  const role = (user.app_metadata?.role as string) ?? 'owner'
  const shopId = user.app_metadata?.shop_id as string | undefined

  let initialLocale: SupportedLocale = speculativeLocale
  let shopName = 'Movestock'
  let personName: string | null = null
  let showChecklistReminder = false

  if (shopId) {
    const needsChecklist = role === 'owner' || role === 'admin'
    const [shopRes, tellerRes, checklistRes] = await Promise.all([
      supabase.from('shops').select('name, language').eq('id', shopId).single(),
      supabase
        .from('tellers')
        .select('name')
        .eq('user_id', user.id)
        .eq('shop_id', shopId)
        .maybeSingle(),
      needsChecklist
        ? getTodayChecklist(shopId, todaySAST()).catch(() => null)
        : Promise.resolve(null),
    ])

    if (shopRes.data?.name) shopName = shopRes.data.name as string
    personName = (tellerRes.data?.name as string | undefined) ?? null
    if (needsChecklist) showChecklistReminder = checklistRes === null

    // Reconcile speculative locale against the shop's stored language. If the
    // cookie was missing or didn't match, do a second fast i18n load for the
    // real locale. For users with the cookie set (the steady state), this is
    // a no-op — speculativeLocale already equals shop.language.
    const shopLang = shopRes.data?.language as string | undefined
    const resolvedShopLocale = parseLocale(shopLang)
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
