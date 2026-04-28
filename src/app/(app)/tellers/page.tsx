'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Teller, AccessRequestWithTeller } from '@/types'
import { Skeleton } from '@/components/Skeleton'
import { ConfirmModal } from '@/components/ConfirmModal'
import { useTranslation } from '@/components/LanguageProvider'
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible'
import { emitDataChanged } from '@/lib/events'

/** "in 2 hours" / "in 45 min" / "soon" — short relative format. */
function formatExpiresIn(iso: string | null): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'soon'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  return remMins === 0 ? `${hrs}h` : `${hrs}h ${remMins}m`
}

export default function TellersPage() {
  const { t } = useTranslation('tellers')
  const [tellers, setTellers] = useState<Teller[]>([])
  const [grants, setGrants] = useState<AccessRequestWithTeller[]>([])
  const [loading, setLoading] = useState(true)
  const [errorKey, setErrorKey] = useState('')
  const [errorRaw, setErrorRaw] = useState('')
  const [pendingRemove, setPendingRemove] = useState<Teller | null>(null)
  const [removing, setRemoving] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tellersRes, grantsRes] = await Promise.all([
        fetch('/api/tellers', { cache: 'no-store' }),
        fetch('/api/access-requests?status=granted', { cache: 'no-store' }),
      ])
      const tellersData = await tellersRes.json()
      if (!tellersRes.ok) {
        if (tellersData.error) setErrorRaw(tellersData.error)
        else setErrorKey('error_load')
        return
      }
      setTellers(tellersData as Teller[])

      // Grants are best-effort — don't block the tellers list if this 403s.
      if (grantsRes.ok) {
        const grantsData = (await grantsRes.json()) as { requests: AccessRequestWithTeller[] }
        setGrants(grantsData.requests ?? [])
      }
      setErrorKey('')
      setErrorRaw('')
    } catch {
      setErrorKey('error_generic')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useRefetchOnVisible(load)

  async function confirmDeactivate() {
    if (!pendingRemove) return
    setRemoving(true)
    const res = await fetch(`/api/tellers/${pendingRemove.id}`, { method: 'PATCH' })
    if (res.ok) {
      setTellers((prev) => prev.filter((t) => t.id !== pendingRemove.id))
      emitDataChanged()
    } else {
      const data = await res.json()
      if (data.error) setErrorRaw(data.error)
      else setErrorKey('error_remove')
    }
    setPendingRemove(null)
    setRemoving(false)
  }

  async function handleRevoke(id: string) {
    setRevokingId(id)
    try {
      const res = await fetch(`/api/access-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      })
      if (res.ok) {
        setGrants((prev) => prev.filter((g) => g.id !== id))
      }
    } finally {
      setRevokingId(null)
    }
  }

  const errorMessage = errorRaw || (errorKey ? t(errorKey) : '')

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/manage" className="text-gray-400 active:text-gray-600 text-sm">
            {t('back')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        </div>
        <Link
          href="/tellers/new"
          className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-blue-700"
        >
          {t('btn_add')}
        </Link>
      </div>

      {errorMessage && <p className="text-red-500 text-sm mb-4">{errorMessage}</p>}

      {/* Active inventory grants — only shows when there are any */}
      {grants.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {t('access_active_title')}
          </p>
          <ul className="space-y-2">
            {grants.map((g) => {
              const busy = revokingId === g.id
              return (
                <li
                  key={g.id}
                  className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-blue-900 truncate">
                      {t('access_active_subtitle', { name: g.teller_name })}
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      {t('access_active_expires', { time: formatExpiresIn(g.expires_at) })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(g.id)}
                    disabled={busy}
                    className="text-xs text-red-500 font-semibold active:text-red-700 px-2 py-1 disabled:opacity-50 shrink-0"
                  >
                    {busy ? t('access_btn_revoking') : t('access_btn_revoke')}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : tellers.length === 0 ? (
        <div className="text-center mt-12">
          <p className="text-gray-400 text-sm">{t('empty')}</p>
          <p className="text-gray-300 text-xs mt-1">{t('empty_hint')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {tellers.map((teller) => (
            <li
              key={teller.id}
              className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
            >
              <div>
                <p className="font-semibold text-gray-900">{teller.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {teller.user_id ? t('has_login') : t('no_login')}
                </p>
              </div>
              <button
                onClick={() => setPendingRemove(teller)}
                disabled={removing}
                className="text-xs text-red-400 font-semibold active:text-red-600 px-2 py-1 disabled:opacity-50"
              >
                {t('btn_remove')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {pendingRemove && (
        <ConfirmModal
          message={t('confirm_remove', { name: pendingRemove.name })}
          confirmLabel={t('btn_remove')}
          isDestructive
          onConfirm={confirmDeactivate}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </main>
  )
}
