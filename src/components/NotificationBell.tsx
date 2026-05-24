'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/components/LanguageProvider'
import type { AccessRequestWithTeller, Reminder } from '@/types'

const PENDING_URL = '/api/access-requests?status=pending'
const REMINDERS_URL = '/api/compliance-reminders'

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-amber-500',
  normal: 'bg-brand',
  low: 'bg-gray-400',
}

/**
 * Owner-only notification sheet. Tapping the bell opens a full-screen,
 * WhatsApp-style chat-list view of every active notification. Tapping a row
 * navigates to the related page to act on it.
 *
 * Reminders are intentionally NOT dismissible — they represent required tasks
 * and are recomputed from live data on every load, so each one clears on its
 * own once the underlying issue is resolved (step done, document renewed,
 * count back to zero, etc.). There's no "Dismiss" control to bury outstanding
 * work. Access requests still have explicit Grant / Deny actions.
 *
 * Full-screen (not a popover) so it can never sit behind the FAB or BottomNav.
 */
export function NotificationBell({ shopId }: { shopId: string }) {
  const { t, tPlural } = useTranslation('manage')
  const { t: tRem } = useTranslation('compliance-reminders')
  const [pending, setPending] = useState<AccessRequestWithTeller[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  // Both endpoints are in the service worker's SWR_GET_PATHS — repeat calls
  // hit the cache instantly and revalidate in the background, and the SW's
  // mutation invalidation (BUG-041) keeps them correct after writes. We
  // deliberately omit cache:'no-store' so the SW can serve the cached copy.
  const refetchAccess = useCallback(async () => {
    try {
      const res = await fetch(PENDING_URL)
      if (!res.ok) return
      const data = (await res.json()) as { requests: AccessRequestWithTeller[] }
      setPending(data.requests ?? [])
    } catch {
      /* network */
    }
  }, [])

  const refetchReminders = useCallback(async () => {
    try {
      const res = await fetch(REMINDERS_URL)
      if (!res.ok) return
      const data = (await res.json()) as { reminders: Reminder[] }
      setReminders(data.reminders ?? [])
    } catch {
      /* network */
    }
  }, [])

  useEffect(() => {
    refetchAccess()
    refetchReminders()

    const supabase = createClient()
    const channel = supabase
      .channel(`access_requests:${shopId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'access_requests',
          filter: `shop_id=eq.${shopId}`,
        },
        () => {
          refetchAccess()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [shopId, refetchAccess, refetchReminders])

  // Lock body scroll while the sheet is open (full-screen sheet semantics).
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  function handleOpen() {
    // No refetch here — the mount effect + realtime subscription keep the
    // data current, and the SW serves any second tap from cache. Forcing a
    // network round-trip on every bell tap was firing the heaviest GET in
    // the app (compliance-reminders runs 10 parallel DB queries).
    setIsOpen(true)
  }

  async function handleResolve(id: string, action: 'grant' | 'deny') {
    setPendingActionId(id)
    try {
      const res = await fetch(`/api/access-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setPending((prev) => prev.filter((r) => r.id !== id))
      }
    } finally {
      setPendingActionId(null)
    }
  }

  const accessCount = pending.length
  const reminderCount = reminders.length
  const totalCount = accessCount + reminderCount
  const hasAny = totalCount > 0

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-full active:bg-gray-100"
        aria-label={tPlural('bell_pending', totalCount, { count: totalCount })}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="w-5 h-5 text-gray-600"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {hasAny && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] bg-chat-canvas flex flex-col">
          {/* Sticky WhatsApp-style teal header */}
          <header
            className="sticky top-0 bg-brand text-white shadow-sm"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div className="flex items-center gap-3 px-4 h-14">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full active:bg-brand-hover"
                aria-label={t('bell_btn_close')}
              >
                <ArrowLeft className="w-5 h-5" strokeWidth={2.25} />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold leading-tight">{t('bell_title')}</h1>
                {hasAny && (
                  <p className="text-xs text-white/80 leading-tight">
                    {tPlural('bell_pending', totalCount, { count: totalCount })}
                  </p>
                )}
              </div>
            </div>
          </header>

          <div
            className="flex-1 overflow-y-auto"
            style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
          >
            {!hasAny ? (
              <div className="flex flex-col items-center justify-center h-full px-8 py-16 text-center">
                <p className="text-base text-gray-500">{t('bell_empty')}</p>
              </div>
            ) : (
              <>
                {reminderCount > 0 && (
                  <section>
                    <h2 className="px-4 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      {t('bell_section_reminders')}
                    </h2>
                    <ul className="bg-white">
                      {reminders.map((r) => {
                        const title = tRem(r.titleKey, r.params)
                        const body = tRem(r.bodyKey, r.params)
                        const dot = PRIORITY_DOT[r.priority] ?? 'bg-gray-400'
                        const RowInner = (
                          <>
                            <span
                              className={`${dot} w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white`}
                              aria-hidden="true"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.25}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                              </svg>
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {title}
                              </p>
                              <p className="text-xs text-gray-500 truncate mt-0.5">{body}</p>
                            </div>
                          </>
                        )
                        return (
                          <li
                            key={r.key}
                            className="border-b border-gray-100 last:border-b-0"
                          >
                            {r.ctaHref ? (
                              <Link
                                href={r.ctaHref}
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 min-w-0"
                              >
                                {RowInner}
                              </Link>
                            ) : (
                              <div className="flex items-center gap-3 px-4 py-3 min-w-0">
                                {RowInner}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}

                {accessCount > 0 && (
                  <section className="mt-2">
                    <h2 className="px-4 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      {t('bell_section_access')}
                    </h2>
                    <ul className="bg-white">
                      {pending.map((req) => {
                        const busy = pendingActionId === req.id
                        const initial = (req.teller_name?.[0] ?? '?').toUpperCase()
                        return (
                          <li
                            key={req.id}
                            className="border-b border-gray-100 last:border-b-0 px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="w-10 h-10 rounded-full bg-brand-light text-brand-dark flex items-center justify-center font-bold shrink-0"
                                aria-hidden="true"
                              >
                                {initial}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                  {t('bell_request_label', { name: req.teller_name })}
                                </p>
                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                  {t('bell_grant_hint')}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button
                                type="button"
                                onClick={() => handleResolve(req.id, 'grant')}
                                disabled={busy}
                                className="flex-1 bg-brand text-white text-sm font-semibold py-2.5 rounded-full active:bg-brand-hover disabled:opacity-50"
                              >
                                {t('bell_btn_grant')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResolve(req.id, 'deny')}
                                disabled={busy}
                                className="flex-1 bg-white border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 rounded-full active:bg-gray-50 disabled:opacity-50"
                              >
                                {t('bell_btn_deny')}
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
