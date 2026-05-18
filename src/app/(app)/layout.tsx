import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OfflineSyncProvider } from '@/components/OfflineSyncProvider'
import { ToastProvider } from '@/components/Toast'
import { LanguageProvider } from '@/components/LanguageProvider'
import { BottomNav } from '@/components/BottomNav'
import { TopAppBar } from '@/components/TopAppBar'
import DailySummaryAlert from '@/components/DailySummaryAlert'
import { InstallPwaButton } from '@/components/InstallPwaButton'
import { ChecklistReminderFab } from '@/components/ChecklistReminderFab'
import { getTodayChecklist, todaySAST } from '@/lib/db/daily-checklist'
import type { SupportedLocale, TranslationNamespace } from '@/lib/i18n/types'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/lib/i18n/types'
import { loadNamespacedTranslations } from '@/lib/i18n/loader'

const APP_SHELL_NAMESPACES: TranslationNamespace[] = [
  'common', 'sale', 'sales', 'dashboard', 'stock', 'stock-loss', 'summary',
  'products', 'tellers', 'expiry', 'settings', 'suppliers', 'checklist',
  'documents', 'waste-pest', 'inspection', 'inventory', 'manage',
  'compliance-onboarding', 'compliance-journey', 'compliance-fund',
  'compliance-reminders',
]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = (user.app_metadata?.role as string) ?? 'owner'
  const shopId = user.app_metadata?.shop_id as string | undefined

  // Parallelise the 3 shop-scoped queries — none depend on each other.
  // Previously this was 3 sequential round trips (~600–1200ms on SA mobile)
  // which delayed even loading.tsx from rendering, since loading boundaries
  // only show after the surrounding layout's awaits resolve.
  let initialLocale: SupportedLocale = DEFAULT_LOCALE
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

    const lang = shopRes.data?.language as string | undefined
    if (lang && SUPPORTED_LOCALES.includes(lang as SupportedLocale)) {
      initialLocale = lang as SupportedLocale
    }
    if (shopRes.data?.name) shopName = shopRes.data.name as string
    personName = (tellerRes.data?.name as string | undefined) ?? null
    if (needsChecklist) showChecklistReminder = checklistRes === null
  }

  // Pre-load all app-shell namespaces server-side and ship them inline with
  // the RSC payload. Saves 22 dynamic-import chunk round trips on first paint
  // (previously every page-load fired one import() per namespace after
  // hydration, which left every useTranslation call returning raw keys until
  // the chunks arrived). loadNamespacedTranslations is cached per (locale,ns)
  // so this is effectively free after the first request per locale.
  const initialNsMap = await loadNamespacedTranslations(initialLocale, APP_SHELL_NAMESPACES)

  const initialChar = (personName ?? shopName).trim().charAt(0).toUpperCase()
  const initial = initialChar || 'M'

  return (
    <div className="min-h-screen bg-surface">
      <LanguageProvider
        initialLocale={initialLocale}
        namespaces={APP_SHELL_NAMESPACES}
        initialNsMap={initialNsMap}
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
        </ToastProvider>
      </LanguageProvider>
    </div>
  )
}
