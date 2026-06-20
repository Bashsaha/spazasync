import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Plus_Jakarta_Sans, Noto_Nastaliq_Urdu } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
})

// Nastaliq is only used via `:lang(ur)` in globals.css. `preload: false` stops
// Next.js emitting a `<link rel="preload" as="font">` for every page load —
// without it, every user downloads ~500KB of Urdu Nastaliq they will never
// render. The font still loads on demand when a page renders Urdu text.
const notoNastaliqUrdu = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-nastaliq',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: 'Movestock',
  description: 'Sales and stock management for your spaza shop',
  // Versioned URL — bumps when manifest content changes so Chrome treats it
  // as a brand-new resource and re-evaluates installability instead of using
  // a cached "not installable" verdict from a previous manifest. Bump on every
  // manifest change.
  manifest: '/manifest.json?v=2026-05-10c',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Movestock',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FFFFFF',
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // CSP nonce set per-request by proxy.ts. Stamping it on our one inline script
  // lets the browser run it under `script-src 'self' 'nonce-…'` (no
  // 'unsafe-inline'). Reading headers() opts the tree into dynamic rendering —
  // acceptable here since the app is authenticated/dynamic already.
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${notoNastaliqUrdu.variable}`}
    >
      <body className="antialiased font-sans bg-surface text-ink">
        {/* Capture beforeinstallprompt as early as possible — Chrome only fires
            it once, often before React hydrates. Stash it on window so the
            InstallPwaButton can read it on mount even if it loaded late. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              window.__bipEvent = null;
              window.addEventListener('beforeinstallprompt', function (e) {
                e.preventDefault();
                window.__bipEvent = e;
                window.dispatchEvent(new CustomEvent('bip-ready'));
              });
              window.addEventListener('appinstalled', function () {
                window.__bipEvent = null;
                window.dispatchEvent(new CustomEvent('bip-installed'));
              });
            `,
          }}
        />
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  )
}
