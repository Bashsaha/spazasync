'use client'

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/components/LanguageProvider'
import type { AccessRequestWithTeller } from '@/types'

const PENDING_URL = '/api/access-requests?status=pending'

/**
 * Owner-only floating-bell with Supabase Realtime backing.
 *
 * Listens to INSERT/UPDATE events on `access_requests` where shop_id matches.
 * RLS guarantees the owner only receives events for their own shop, but we
 * also filter client-side so the WebSocket payload stays small. Falls back
 * to a one-shot HTTP fetch on mount in case the WebSocket is delayed; the
 * supabase-js client auto-reconnects if the connection drops.
 */
export function NotificationBell({ shopId }: { shopId: string }) {
  const { t, tPlural } = useTranslation('manage')
  const [pending, setPending] = useState<AccessRequestWithTeller[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(PENDING_URL, { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { requests: AccessRequestWithTeller[] }
      setPending(data.requests ?? [])
    } catch {
      /* network — leave existing list */
    }
  }, [])

  // Initial fetch + Realtime subscription. Cleans up on unmount.
  useEffect(() => {
    refetch()

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
          // Any insert/update — re-pull the list (cheap; capped to 50 rows).
          refetch()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [shopId, refetch])

  async function handleResolve(id: string, action: 'grant' | 'deny') {
    setPendingActionId(id)
    try {
      const res = await fetch(`/api/access-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        // Optimistic — Realtime will also remove it, but make the UI feel snappy.
        setPending((prev) => prev.filter((r) => r.id !== id))
      }
    } finally {
      setPendingActionId(null)
    }
  }

  const count = pending.length
  const hasPending = count > 0

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative w-9 h-9 flex items-center justify-center rounded-full active:bg-gray-100"
        aria-label={tPlural('bell_pending', count, { count })}
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
        {hasPending && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
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

            {!hasPending ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-400">{t('bell_empty')}</p>
              </div>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
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
            )}
          </div>
        </div>
      )}
    </>
  )
}
