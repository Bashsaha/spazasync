'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  const router = useRouter()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close popover on outside-click or Escape.
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  async function handleSwitchUser() {
    if (busy) return
    setBusy(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } finally {
      // Always navigate back to login — even on signOut error the safest place
      // to recover is the login screen.
      router.push('/login')
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 truncate text-base leading-tight">{title}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 truncate leading-tight mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {bellShopId && <NotificationBell shopId={bellShopId} />}

          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 active:bg-blue-700"
              aria-label={t('switch_user')}
              aria-expanded={open}
              aria-haspopup="menu"
            >
              {initial}
            </button>

            {open && (
              <div
                role="menu"
                className="absolute top-full right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-gray-50">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {t('signed_in_as')}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">{title}</p>
                  {subtitle && (
                    <p className="text-xs text-gray-500 truncate">{subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSwitchUser}
                  disabled={busy}
                  className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-800 active:bg-gray-50 flex items-center gap-3 disabled:opacity-60"
                >
                  <span className="text-lg leading-none">↩</span>
                  <span className="flex-1">
                    {busy ? t('signing_out') : t('switch_user')}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
