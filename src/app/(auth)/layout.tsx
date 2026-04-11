import { LanguageProvider } from '@/components/LanguageProvider'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider namespaces={['common', 'auth']}>
      {children}
    </LanguageProvider>
  )
}
