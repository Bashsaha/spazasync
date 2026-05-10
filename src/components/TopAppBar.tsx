'use client'

import Link from 'next/link'
import { useTranslation } from '@/components/LanguageProvider'
import { NotificationBell } from '@/components/NotificationBell'

export function TopAppBar({
  title,
  subtitle,
  initial,
  bellShopId,
}: {
  title: string
  subtitle?: string
  initial: string
  /** When set, renders the owner notification bell wired to this shop. */
  bellShopId?: string
}) {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-30 bg-white">
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-brand truncate text-base leading-tight">Movestock</p>
          {(subtitle || title) && (
            <p className="text-xs text-gray-400 truncate leading-tight mt-0.5">
              {subtitle ?? title}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {bellShopId && <NotificationBell shopId={bellShopId} />}

          {/* Avatar opens the Profile page (WhatsApp-style entry point). */}
          <Link
            href="/profile"
            className="w-9 h-9 rounded-full bg-brand text-white font-bold flex items-center justify-center shrink-0 active:bg-brand-hover"
            aria-label={t('profile_title')}
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  )
}
