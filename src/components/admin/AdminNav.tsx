'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { signOutAndPurge } from '@/lib/offline/sign-out'
import { useToast } from '@/components/Toast'

const navLinks = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/shops', label: 'Shops' },
  { href: '/admin/field-sales', label: 'Field sales' },
  { href: '/admin/catalog', label: 'Catalog' },
  { href: '/admin/alerts', label: 'Alerts' },
  { href: '/admin/eft-reconcile', label: 'EFT' },
]

export default function AdminNav({ hasShop }: { hasShop?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { addToast } = useToast()

  async function handleSignOut() {
    try {
      // Sign out + purge all shop/user-scoped caches (SECURITY-001) before the
      // next user logs in on this device.
      await signOutAndPurge()
      router.push('/login')
    } catch {
      addToast('Sign out failed', 'error')
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4">
        {/* Row 1 — brand + account actions */}
        <div className="h-14 flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-gray-900 tracking-tight">
            Movestock Admin
          </span>
          <div className="flex items-center gap-3 shrink-0">
            {hasShop && (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-full bg-brand text-white hover:bg-brand-hover transition-colors whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden /> Shop app
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors whitespace-nowrap"
            >
              Sign out
            </button>
          </div>
        </div>
        {/* Row 2 — section nav (horizontally scrollable on small screens) */}
        <nav className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-2 no-scrollbar">
          {navLinks.map((link) => {
            const isActive =
              link.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 text-sm rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-brand-light text-brand-hover font-semibold'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
