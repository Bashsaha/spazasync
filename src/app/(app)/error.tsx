'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useTranslation()

  useEffect(() => {
    console.error(error)

    // Most (app) errors are transient resume-from-background blips: the access
    // token expired or the radio was mid-wake when a Server Component ran, so a
    // query threw. Auto-recover by re-running the render — once the network is
    // back if we're offline, or after a short beat if we're online — instead of
    // showing the alarming screen for something a reload would fix.
    //
    // A short throttle stops a genuinely-persistent error from looping: the
    // first occurrence retries silently; an immediate re-throw within the
    // window falls through to the manual "Try again" screen below.
    const AUTORETRY_KEY = 'mvs_err_autoretry_at'
    const AUTORETRY_THROTTLE_MS = 10_000

    let recentlyRetried = false
    try {
      const last = Number(sessionStorage.getItem(AUTORETRY_KEY) || 0)
      recentlyRetried = Date.now() - last < AUTORETRY_THROTTLE_MS
    } catch {
      /* private mode / quota — skip auto-retry, show the manual screen */
    }
    if (recentlyRetried) return

    function retry() {
      try {
        sessionStorage.setItem(AUTORETRY_KEY, String(Date.now()))
      } catch {
        /* ignore */
      }
      reset()
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const onOnline = () => retry()
      window.addEventListener('online', onOnline, { once: true })
      return () => window.removeEventListener('online', onOnline)
    }

    const timer = setTimeout(retry, 1200)
    return () => clearTimeout(timer)
  }, [error, reset])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-surface">
      <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" strokeWidth={1.75} />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('error_page_title')}</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">
        {t('error_page_desc')}
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={reset}
          autoFocus
          className="bg-brand text-white font-semibold px-6 py-3 rounded-full active:bg-brand-hover"
        >
          {t('error_btn_try_again')}
        </button>
        <Link
          href="/dashboard"
          className="text-center text-brand font-semibold px-6 py-3 rounded-xl border border-brand-light active:bg-brand-light"
        >
          {t('btn_goto_dashboard')}
        </Link>
      </div>
    </div>
  )
}
