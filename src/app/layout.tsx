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
  manifest: '/manifest.json',
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
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  )
}
