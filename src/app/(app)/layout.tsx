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
import type { SupportedLocale } from '@/lib/i18n/types'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/lib/i18n/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = (user.app_metadata?.role as string) ?? 'owner'
  const shopId = user.app_metadata?.shop_id as string | undefined

  // Fetch shop info (name + language) in one round trip when we have a shop.
  let initialLocale: SupportedLocale = DEFAULT_LOCALE
  let shopName = 'Movestock'
  if (shopId) {
    const { data: shop } = await supabase
      .from('shops')
      .select('name, language')
      .eq('id', shopId)
      .single()
    const lang = shop?.language as string | undefined
    if (lang && SUPPORTED_LOCALES.includes(lang as SupportedLocale)) {
      initialLocale = lang as SupportedLocale
    }
    if (shop?.name) shopName = shop.name as string
  }

  // Fetch the signed-in person's display name from tellers for owners, tellers,
  // and dual-role admins (admins promoted from owners keep their shop_id and
  // their tellers row). The lookup is by user_id + shop_id, so excluding admin
  // here was a bug — admins with a shop wouldn't see their name. (BUG-029.)
  let personName: string | null = null
  if (shopId) {
    const { data: teller } = await supabase
      .from('tellers')
      .select('name')
      .eq('user_id', user.id)
      .eq('shop_id', shopId)
      .maybeSingle()
    personName = (teller?.name as string | undefined) ?? null
  }

  const initialChar = (personName ?? shopName).trim().charAt(0).toUpperCase()
  const initial = initialChar || 'M'

  // Owners only — show a pulsing reminder FAB whenever today's daily
  // checklist hasn't been done yet. One Postgres round trip; failures
  // silently disable the reminder rather than blocking layout render.
  let showChecklistReminder = false
  if (shopId && (role === 'owner' || role === 'admin')) {
    try {
      const checklist = await getTodayChecklist(shopId, todaySAST())
      showChecklistReminder = checklist === null
    } catch {
      showChecklistReminder = false
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <LanguageProvider
        initialLocale={initialLocale}
        namespaces={['common', 'sale', 'sales', 'dashboard', 'stock', 'summary', 'products', 'tellers', 'expiry', 'settings', 'suppliers', 'checklist', 'documents', 'waste-pest', 'inspection', 'inventory', 'manage', 'compliance-onboarding', 'compliance-journey', 'compliance-fund', 'compliance-reminders']}
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
