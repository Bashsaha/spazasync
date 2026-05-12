'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { X, ChevronRight } from 'lucide-react'
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
 * Owner-only notification drawer. Surfaces two things:
 *   1. Pending teller inventory-access requests (Realtime-backed).
 *   2. Smart compliance reminders (Phase 37g) — refetched on bell open and
 *      after any dismiss/grant action.
 *
 * Reminders are rendered as clickable rows: tap to navigate to the related
 * page (ctaHref) — that implicitly acknowledges the reminder; the cross
 * button explicitly dismisses it via the existing `/dismiss` endpoint.
 */
export function NotificationBell({ shopId }: { shopId: string }) {
  const { t, tPlural } = useTranslation('manage')
  const { t: tRem } = useTranslation('compliance-reminders')
  const [pending, setPending] = useState<AccessRequestWithTeller[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [dismissingKey, setDismissingKey] = useState<string | null>(null)

  const refetchAccess = useCallback(async () => {
    try {
      const res = await fetch(PENDING_URL, { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { requests: AccessRequestWithTeller[] }
      setPending(data.requests ?? [])
    } catch {
      /* network — leave existing list */
    }
  }, [])

  const refetchReminders = useCallback(async () => {
    try {
      const res = await fetch(REMINDERS_URL, { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { reminders: Reminder[] }
      setReminders(data.reminders ?? [])
    } catch {
      /* network — leave existing list */
    }
  }, [])

  // Initial fetch + Realtime subscription for access requests. Reminders are
  // polled lazily: on mount (for badge count) and again on bell open.
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

  function handleOpen() {
    setIsOpen(true)
    // Bell opens — refresh both lists so the drawer is current.
    refetchAccess()
    refetchReminders()
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

  async function handleDismissReminder(r: Reminder) {
    setDismissingKey(r.key)
    // Optimistic — remove immediately. If the call fails, refetch will restore.
    setReminders((prev) => prev.filter((x) => x.key !== r.key))
    try {
      await fetch('/api/compliance-reminders/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_type: r.type, reminder_key: r.key }),
      })
    } catch {
      refetchReminders()
    } finally {
      setDismissingKey(null)
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
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{t('bell_title')}</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400"
                aria-label={t('bell_btn_close')}
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {!hasAny ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-400">{t('bell_empty')}</p>
              </div>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto">
                {reminderCount > 0 && (
                  <section>
                    <h3 className="px-5 pt-4 pb-1 text-xs font-bold uppercase tracking-wide text-gray-400">
                      {t('bell_section_reminders')}
                    </h3>
                    <ul className="divide-y divide-gray-50">
                      {reminders.map((r) => {
                        const busy = dismissingKey === r.key
                        const title = tRem(r.titleKey, r.params)
                        const body = tRem(r.bodyKey, r.params)
                        const ctaLabel = r.ctaKey ? tRem(r.ctaKey, r.params) : t('bell_btn_view')
                        const dot = PRIORITY_DOT[r.priority] ?? 'bg-gray-400'
                        return (
                          <li key={r.key} className="px-5 py-3 flex items-start gap-3">
                            <span
                              className={`${dot} w-2 h-2 rounded-full mt-1.5 shrink-0`}
                              aria-hidden="true"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 leading-snug">
                                {title}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5 leading-snug">{body}</p>
                              <div className="flex items-center gap-3 mt-2">
                                {r.ctaHref && (
                                  <Link
                                    href={r.ctaHref}
                                    onClick={() => setIsOpen(false)}
                                    className="text-xs font-semibold text-brand active:text-brand-hover inline-flex items-center gap-0.5"
                                  >
                                    {ctaLabel}
                                    <ChevronRight className="w-3 h-3" strokeWidth={2.5} />
                                  </Link>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDismissReminder(r)}
                                  disabled={busy}
                                  className="text-xs font-semibold text-gray-400 active:text-gray-600 disabled:opacity-50"
                                >
                                  {t('bell_btn_dismiss')}
                                </button>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}

                {accessCount > 0 && (
                  <section>
                    <h3 className="px-5 pt-4 pb-1 text-xs font-bold uppercase tracking-wide text-gray-400">
                      {t('bell_section_access')}
                    </h3>
                    <ul className="divide-y divide-gray-50">
                      {pending.map((req) => {
                        const busy = pendingActionId === req.id
                        return (
                          <li key={req.id} className="px-5 py-4">
                            <p className="text-sm font-semibold text-gray-900">
                              {t('bell_request_label', { name: req.teller_name })}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{t('bell_grant_hint')}</p>
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
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
