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

interface BottomNavProps {
  role: string
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname()
  const items = role === 'teller' ? tellerNav : ownerNav

  // Tellers only have one nav item — no need for a nav bar
  if (role === 'teller') return null

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
                isActive ? 'text-orange-500' : 'text-gray-400 active:text-orange-400'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className={`text-[10px] font-semibold ${isActive ? 'text-orange-500' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
