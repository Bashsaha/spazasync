'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: string
}

const ownerNav: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/sale', label: 'Sale', icon: '🧾' },
  { href: '/stock', label: 'Stock', icon: '📦' },
  { href: '/products', label: 'Products', icon: '🏷️' },
  { href: '/tellers', label: 'Tellers', icon: '👤' },
]

const tellerNav: NavItem[] = [
  { href: '/sale', label: 'Sale', icon: '🧾' },
]

const adminNav: NavItem[] = [
  ...ownerNav,
  { href: '/admin', label: 'Admin', icon: '⚙️' },
]

interface BottomNavProps {
  role: string
  hasShop?: boolean
}

export function BottomNav({ role, hasShop }: BottomNavProps) {
  const pathname = usePathname()

  // Tellers only see sale tab
  if (role === 'teller') return null
  // Admin without a shop has no bottom nav (uses AdminNav instead)
  if (role === 'admin' && !hasShop) return null

  const items = role === 'admin' ? adminNav : ownerNav

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-lg z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-lg mx-auto flex items-center justify-around">
        {items.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-h-[56px] min-w-[56px] transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-400 active:text-blue-500'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className={`text-[10px] font-semibold ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
