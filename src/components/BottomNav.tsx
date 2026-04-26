'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'

interface NavItem {
  href: string
  labelKey: string
  icon: string
  /** Other path prefixes that should also light this tab as active. */
  matches?: string[]
}

const ownerNav: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav_home', icon: '🏠' },
  {
    href: '/sales',
    labelKey: 'nav_sales',
    icon: '🧾',
    matches: ['/sales'],
  },
  {
    href: '/inventory',
    labelKey: 'nav_inventory',
    icon: '📦',
    matches: ['/inventory', '/products', '/stock', '/stock-take', '/expiry', '/suppliers'],
  },
  {
    href: '/manage',
    labelKey: 'nav_manage',
    icon: '👤',
    matches: ['/manage', '/tellers', '/inspection', '/checklist', '/documents', '/waste-pest'],
  },
  { href: '/settings', labelKey: 'nav_settings', icon: '⚙️', matches: ['/settings', '/subscribe'] },
]

const adminExtra: NavItem = { href: '/admin', labelKey: 'nav_admin', icon: '🛡️', matches: ['/admin'] }

interface BottomNavProps {
  role: string
  hasShop?: boolean
}

export function BottomNav({ role, hasShop }: BottomNavProps) {
  const pathname = usePathname()
  const { t } = useTranslation()

  // Tellers only see sale tab
  if (role === 'teller') return null
  // Admin without a shop has no bottom nav (uses AdminNav instead)
  if (role === 'admin' && !hasShop) return null

  const items = role === 'admin' ? [...ownerNav, adminExtra] : ownerNav
  const onSalePage = pathname.startsWith('/sale') && !pathname.startsWith('/sales')

  return (
    <>
      {!onSalePage && (
        <Link
          href="/sale"
          className="fixed z-50 right-4 bg-blue-600 text-white rounded-full shadow-lg active:bg-blue-700 transition-colors flex items-center gap-2 pl-4 pr-5 h-14"
          style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
          aria-label={t('nav_start_sale')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
          </svg>
          <span className="text-sm font-bold whitespace-nowrap">{t('nav_new_sale')}</span>
        </Link>
      )}
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-lg z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-around">
          {items.map((item) => {
            const isActive = (() => {
              if (item.href === '/dashboard') return pathname === '/dashboard'
              const prefixes = item.matches ?? [item.href]
              return prefixes.some((p) =>
                p === '/sales'
                  // /sales must NOT light up while on /sale (the actual sale flow)
                  ? pathname === '/sales' || pathname.startsWith('/sales/')
                  : pathname === p || pathname.startsWith(p + '/'),
              )
            })()
            const label = t(item.labelKey)

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
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
