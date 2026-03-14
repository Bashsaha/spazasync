'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Teller } from '@/types'

interface Props {
  onSelect: (teller: Teller) => void
  selectedId: string | null | undefined
}

/**
 * Shown on the sale page when the current user is an owner.
 * Lets the owner pick which teller is serving before scanning begins.
 */
export function TellerSelector({ onSelect, selectedId }: Props) {
  const [tellers, setTellers] = useState<Teller[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tellers')
      .then((r) => r.json())
      .then((data: Teller[]) => setTellers(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-400 text-sm">Loading tellers…</p>

  if (tellers.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No tellers yet.{' '}
        <Link href="/tellers/new" className="text-blue-600 font-semibold">
          Add one
        </Link>
        .
      </p>
    )
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-3">Who is serving?</p>
      <div className="space-y-2">
        {tellers.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className={`w-full text-left px-4 py-3 rounded-2xl border font-semibold text-sm min-h-[48px] ${
              t.id === selectedId
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-900 border-gray-200 active:bg-gray-50'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  )
}
