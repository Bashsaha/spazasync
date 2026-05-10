'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Receipt, Package, Users, Shield, Plus, type LucideIcon } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'

interface NavItem {
  href: string
  labelKey: string
  Icon: LucideIcon
  /** Other path prefixes that should also light this tab as active. */
  matches?: string[]
}

const ownerNav: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav_home', Icon: Home },
  {
    href: '/sales',
    labelKey: 'nav_sales',
    Icon: Receipt,
    matches: ['/sales'],
  },
  {
    href: '/inventory',
    labelKey: 'nav_inventory',
    Icon: Package,
    matches: ['/inventory', '/products', '/stock', '/stock-take', '/expiry', '/suppliers'],
  },
  {
    href: '/manage',
    labelKey: 'nav_manage',
    Icon: Users,
    matches: ['/manage', '/tellers', '/inspection', '/checklist', '/documents', '/waste-pest'],
  },
]

const adminExtra: NavItem = { href: '/admin', labelKey: 'nav_admin', Icon: Shield, matches: ['/admin'] }

// Tellers see two tabs: their primary sale flow + the inventory hub (which
// itself decides whether to show "request access" or the granted tile grid).
const tellerNav: NavItem[] = [
  { href: '/sale', labelKey: 'nav_sales', Icon: Receipt, matches: ['/sale'] },
  {
    href: '/inventory',
    labelKey: 'nav_inventory',
    Icon: Package,
    matches: ['/inventory', '/products', '/stock', '/stock-take', '/expiry', '/suppliers'],
  },
]

interface BottomNavProps {
  role: string
  hasShop?: boolean
}

export function BottomNav({ role, hasShop }: BottomNavProps) {
  const pathname = usePathname()
  const { t } = useTranslation()

  // Admin without a shop has no bottom nav (uses AdminNav instead)
  if (role === 'admin' && !hasShop) return null

  const items =
    role === 'teller'
      ? tellerNav
      : role === 'admin'
      ? [...ownerNav, adminExtra]
      : ownerNav

  // Hide the FAB on the /sale flow itself (where the user is already running a
  // sale) and on /sales (the hub already has a big "Start a Sale" CTA). Tellers
  // never need the FAB because their primary tab IS /sale.
  const onSalePage = pathname === '/sale' || pathname.startsWith('/sale/')
  const showFab = role !== 'teller' && !onSalePage

  return (
    <>
      {showFab && (
        <Link
          href="/sale"
          className="fixed z-30 right-4 bg-brand text-white rounded-full active:bg-brand-hover transition-colors flex items-center gap-2 pl-4 pr-5 h-14"
          style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
          aria-label={t('nav_start_sale')}
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
          <span className="text-sm font-bold whitespace-nowrap">{t('nav_new_sale')}</span>
        </Link>
      )}
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-40"
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
                  isActive ? 'text-brand' : 'text-gray-400 active:text-brand'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.Icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 1.75} />
                <span className={`text-[10px] font-semibold ${isActive ? 'text-brand' : 'text-gray-400'}`}>
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
