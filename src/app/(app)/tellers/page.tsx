'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Teller } from '@/types'
import { Skeleton } from '@/components/Skeleton'
import { ConfirmModal } from '@/components/ConfirmModal'
import { useTranslation } from '@/components/LanguageProvider'

export default function TellersPage() {
  const { t } = useTranslation('tellers')
  const [tellers, setTellers] = useState<Teller[]>([])
  const [loading, setLoading] = useState(true)
  const [errorKey, setErrorKey] = useState('')
  const [errorRaw, setErrorRaw] = useState('')
  const [pendingRemove, setPendingRemove] = useState<Teller | null>(null)
  const [removing, setRemoving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/tellers')
      const data = await res.json()
      if (!res.ok) {
        if (data.error) setErrorRaw(data.error)
        else setErrorKey('error_load')
        return
      }
      setTellers(data as Teller[])
    } catch {
      setErrorKey('error_generic')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function confirmDeactivate() {
    if (!pendingRemove) return
    setRemoving(true)
    const res = await fetch(`/api/tellers/${pendingRemove.id}`, { method: 'PATCH' })
    if (res.ok) {
      setTellers((prev) => prev.filter((t) => t.id !== pendingRemove.id))
    } else {
      const data = await res.json()
      if (data.error) setErrorRaw(data.error)
      else setErrorKey('error_remove')
    }
    setPendingRemove(null)
    setRemoving(false)
  }

  const errorMessage = errorRaw || (errorKey ? t(errorKey) : '')

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 active:text-gray-600 text-sm">
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

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : tellers.length === 0 ? (
        <p className="text-center text-gray-400 text-sm mt-12">
          {t('empty')}
        </p>
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
