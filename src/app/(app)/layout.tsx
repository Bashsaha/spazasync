import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OfflineSyncProvider } from '@/components/OfflineSyncProvider'
import { ToastProvider } from '@/components/Toast'
import { LanguageProvider } from '@/components/LanguageProvider'
import { BottomNav } from '@/components/BottomNav'
import { TopAppBar } from '@/components/TopAppBar'
import DailySummaryAlert from '@/components/DailySummaryAlert'
import MonthlyComplianceAlert from '@/components/MonthlyComplianceAlert'
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

  // For tellers, also fetch their display name so the avatar + dropdown reflect
  // *who* is signed in (not just which shop). One small query — RLS limits it
  // to the teller's own row.
  let tellerName: string | null = null
  if (role === 'teller') {
    const { data: teller } = await supabase
      .from('tellers')
      .select('name')
      .eq('user_id', user.id)
      .maybeSingle()
    tellerName = (teller?.name as string | undefined) ?? null
  }

  const initialChar = (role === 'teller' && tellerName ? tellerName : shopName)
    .trim()
    .charAt(0)
    .toUpperCase()
  const initial = initialChar || 'M'

  return (
    <div className="min-h-screen bg-gray-50">
      <LanguageProvider
        initialLocale={initialLocale}
        namespaces={['common', 'sale', 'sales', 'dashboard', 'stock', 'summary', 'products', 'tellers', 'expiry', 'settings', 'suppliers', 'checklist', 'documents', 'waste-pest', 'inspection', 'inventory', 'manage']}
      >
        <ToastProvider>
          <TopAppBar
            title={shopName}
            subtitle={role === 'teller' ? tellerName ?? undefined : undefined}
            initial={initial}
          />
          {role !== 'teller' && <DailySummaryAlert />}
          {role !== 'teller' && <MonthlyComplianceAlert />}
          <OfflineSyncProvider>
            {children}
          </OfflineSyncProvider>
          <BottomNav role={role} hasShop={!!shopId} />
        </ToastProvider>
      </LanguageProvider>
    </div>
  )
}
