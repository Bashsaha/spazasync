'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Teller } from '@/types'
import { Skeleton } from '@/components/Skeleton'
import { ConfirmModal } from '@/components/ConfirmModal'

export default function TellersPage() {
  const [tellers, setTellers] = useState<Teller[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingRemove, setPendingRemove] = useState<Teller | null>(null)
  const [removing, setRemoving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/tellers')
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not load tellers'); return }
      setTellers(data as Teller[])
    } catch {
      setError('Something went wrong.')
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
      setError(data.error ?? 'Could not remove teller.')
    }
    setPendingRemove(null)
    setRemoving(false)
  }

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 active:text-gray-600 text-sm">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Tellers</h1>
        </div>
        <Link
          href="/tellers/new"
          className="bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-orange-600"
        >
          + Add
        </Link>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : tellers.length === 0 ? (
        <p className="text-center text-gray-400 text-sm mt-12">
          No tellers yet. Tap + Add to create one.
        </p>
      ) : (
        <ul className="space-y-2">
          {tellers.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
            >
              <div>
                <p className="font-semibold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t.user_id ? 'Has own login' : 'No login'}
                </p>
              </div>
              <button
                onClick={() => setPendingRemove(t)}
                disabled={removing}
                className="text-xs text-red-400 font-semibold active:text-red-600 px-2 py-1 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {pendingRemove && (
        <ConfirmModal
          message={`Remove ${pendingRemove.name} from your tellers?`}
          confirmLabel="Remove"
          isDestructive
          onConfirm={confirmDeactivate}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </main>
  )
}
