import Link from 'next/link'

/**
 * Public legal section (Privacy Policy + Terms of Service).
 *
 * These pages are deliberately OUTSIDE the (auth) and (app) route groups so
 * they carry no LanguageProvider and no auth dependency — they're reachable
 * logged-out (footer links on /login + /onboarding) and logged-in (settings
 * footer). proxy.ts early-returns on /legal so authenticated users are NOT
 * bounced away the way they are from /login.
 *
 * Content is English-only by design (English is the operative version for
 * South African POPIA purposes), so no i18n is wired here.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-brand">
            Movestock
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/legal/privacy" className="text-gray-600 hover:text-brand">
              Privacy
            </Link>
            <Link href="/legal/terms" className="text-gray-600 hover:text-brand">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 pb-16">{children}</main>

      <footer className="mx-auto max-w-3xl px-4 pb-10 text-center text-xs text-gray-400">
        Movestock — a product of Veyon
      </footer>
    </div>
  )
}
