'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'

const navLinks = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/shops', label: 'Shops' },
  { href: '/admin/catalog', label: 'Catalog' },
  { href: '/admin/alerts', label: 'Alerts' },
]

export default function AdminNav({ hasShop }: { hasShop?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { addToast } = useToast()

  async function handleSignOut() {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) {
        addToast('Sign out failed', 'error')
        return
      }
      router.push('/login')
    } catch {
      addToast('Sign out failed', 'error')
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-sm font-bold text-gray-900 tracking-tight">
            Movestock Admin
          </span>
          <nav className="flex gap-1">
            {navLinks.map((link) => {
              const isActive =
                link.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
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
        <div className="flex items-center gap-4">
          {hasShop && (
            <Link
              href="/dashboard"
              className="px-3 py-1.5 text-sm font-semibold rounded-full bg-brand text-white hover:bg-brand-hover transition-colors"
            >
              My Shop &rarr;
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
