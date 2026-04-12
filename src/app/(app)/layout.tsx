import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OfflineSyncProvider } from '@/components/OfflineSyncProvider'
import { ToastProvider } from '@/components/Toast'
import { LanguageProvider } from '@/components/LanguageProvider'
import { BottomNav } from '@/components/BottomNav'
import DailySummaryAlert from '@/components/DailySummaryAlert'
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

  // Fetch shop language for initial render (avoids flash of wrong language)
  let initialLocale: SupportedLocale = DEFAULT_LOCALE
  if (shopId) {
    const { data: shop } = await supabase
      .from('shops')
      .select('language')
      .eq('id', shopId)
      .single()
    const lang = shop?.language as string | undefined
    if (lang && SUPPORTED_LOCALES.includes(lang as SupportedLocale)) {
      initialLocale = lang as SupportedLocale
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LanguageProvider
        initialLocale={initialLocale}
        namespaces={['common', 'sale', 'dashboard', 'stock', 'summary', 'products', 'tellers', 'expiry', 'settings']}
      >
        <ToastProvider>
          {role !== 'teller' && <DailySummaryAlert />}
          <OfflineSyncProvider>
            {children}
          </OfflineSyncProvider>
          <BottomNav role={role} hasShop={!!shopId} />
        </ToastProvider>
      </LanguageProvider>
    </div>
  )
}
