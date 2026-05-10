import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Noto_Sans_Ethiopic, Noto_Nastaliq_Urdu } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
})

const notoEthiopic = Noto_Sans_Ethiopic({
  subsets: ['ethiopic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ethiopic',
  display: 'swap',
})

const notoNastaliqUrdu = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-nastaliq',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Movestock',
  description: 'Sales and stock management for your spaza shop',
  // Versioned URL — bumps when manifest content changes so Chrome treats it
  // as a brand-new resource and re-evaluates installability instead of using
  // a cached "not installable" verdict from a previous manifest. Bump on every
  // manifest change.
  manifest: '/manifest.json?v=2026-05-10',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Movestock',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1ABC9C',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${notoEthiopic.variable} ${notoNastaliqUrdu.variable}`}
    >
      <body className="antialiased font-sans bg-surface text-ink">
        {/* Capture beforeinstallprompt as early as possible — Chrome only fires
            it once, often before React hydrates. Stash it on window so the
            InstallPwaButton can read it on mount even if it loaded late. */}
        <script
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
