import { cookies } from 'next/headers'
import { LanguageProvider } from '@/components/LanguageProvider'
import { InstallPwaButton } from '@/components/InstallPwaButton'
import type { SupportedLocale, TranslationNamespace } from '@/lib/i18n/types'
import { DEFAULT_LOCALE } from '@/lib/i18n/types'
import { loadNamespacedTranslations } from '@/lib/i18n/loader'
import { LOCALE_COOKIE, parseLocale } from '@/lib/i18n/locale-cookie'

const AUTH_NAMESPACES: TranslationNamespace[] = ['common', 'auth']

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Read locale from cookie so a returning user lands on /login in their
  // chosen language without any client-side flash. No DB query: this layout
  // runs while the user is unauthenticated.
  const cookieStore = await cookies()
  const initialLocale: SupportedLocale =
    parseLocale(cookieStore.get(LOCALE_COOKIE)?.value) ?? DEFAULT_LOCALE

  const initialNsMap = await loadNamespacedTranslations(initialLocale, AUTH_NAMESPACES)

  return (
    <LanguageProvider
      initialLocale={initialLocale}
      namespaces={AUTH_NAMESPACES}
      initialNsMap={initialNsMap}
    >
      <InstallPwaButton />
      {children}
    </LanguageProvider>
  )
}
