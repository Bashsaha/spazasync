import { LanguageProvider } from '@/components/LanguageProvider'
import { InstallPwaButton } from '@/components/InstallPwaButton'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider namespaces={['common', 'auth']}>
      <InstallPwaButton />
      {children}
    </LanguageProvider>
  )
}
