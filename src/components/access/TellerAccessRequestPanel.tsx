'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'
import type { AccessRequest, TellerAccessStatus } from '@/types'

/**
 * The /inventory view shown to a teller without an active inventory grant.
 * Drives request submission + reflects pending/denied/revoked/expired states.
 */
export function TellerAccessRequestPanel({
  initialStatus,
}: {
  initialStatus: TellerAccessStatus
}) {
  const router = useRouter()
  const { t } = useTranslation('inventory')
  const [current, setCurrent] = useState<AccessRequest | null>(initialStatus.current_request)
  const [submitting, setSubmitting] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)

  const status = current?.status ?? null
  const isPending = status === 'pending'
  const isDenied = status === 'denied'
  const isRevoked = status === 'revoked'
  // Treat both 'expired' status and a stale 'granted' row (expires_at in the
  // past) as expired for UI purposes.
  const isExpired =
    status === 'expired' ||
    (status === 'granted' &&
      current?.expires_at != null &&
      new Date(current.expires_at).getTime() <= Date.now())

  async function handleRequest() {
    setSubmitting(true)
    setErrorKey(null)
    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'inventory' }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'already_pending') setErrorKey('access_error_pending')
        else if (data.error === 'already_granted') setErrorKey('access_error_granted')
        else setErrorKey('access_error_generic')
        return
      }
      setCurrent(data.request as AccessRequest)
      // Best-effort hint to the layout to refetch once the owner approves —
      // the proxy will reroute the teller through /inventory if they navigate
      // somewhere blocked.
      router.refresh()
    } catch {
      setErrorKey('access_error_generic')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('hint')}</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 ">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-light mx-auto mb-4">
          <Lock className="w-7 h-7 text-brand-hover" strokeWidth={1.75} />
        </div>

        {isPending ? (
          <>
            <p className="text-center text-base font-bold text-gray-900">
              {t('access_pending_title')}
            </p>
            <p className="text-center text-sm text-gray-500 mt-2">
              {t('access_pending_hint')}
            </p>
          </>
        ) : (
          <>
            <p className="text-center text-base font-bold text-gray-900">
              {t('access_denied_title')}
            </p>
            <p className="text-center text-sm text-gray-500 mt-2">
              {t('access_explanation')}
            </p>

            {(isDenied || isRevoked || isExpired) && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 mt-4 text-center">
                {isDenied
                  ? t('access_denied_status')
                  : isRevoked
                  ? t('access_revoked')
                  : t('access_expired')}
              </p>
            )}

            <button
              type="button"
              onClick={handleRequest}
              disabled={submitting}
              className="w-full bg-brand text-white font-semibold py-3 rounded-full active:bg-brand-hover disabled:opacity-50 mt-5 min-h-[48px]"
            >
              {submitting
                ? t('access_btn_requesting')
                : status
                ? t('access_btn_request_again')
                : t('access_btn_request')}
            </button>

            {errorKey && (
              <p className="text-red-600 text-sm text-center mt-3">{t(errorKey)}</p>
            )}
          </>
        )}
      </div>
    </main>
  )
}
