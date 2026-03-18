'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { BarcodeCatalogEntry } from '@/types'

export default function AdminCatalogPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [entries, setEntries] = useState<BarcodeCatalogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const limit = 20

  const fetchEntries = useCallback(async (s: string, p: number) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (s) params.set('search', s)
      params.set('page', String(p))
      params.set('limit', String(limit))

      const res = await fetch(`/api/admin/catalog?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries)
        setTotal(data.total)
      } else {
        setError('Failed to load catalog')
      }
    } catch {
      setError('Network error — check your connection')
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchEntries(search, 1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, fetchEntries])

  // Page changes (not debounced)
  useEffect(() => {
    if (page > 1) fetchEntries(search, page)
  }, [page, search, fetchEntries])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Barcode Catalog</h1>
        <button
          onClick={() => router.push('/admin/catalog/new')}
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Add Entry
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by barcode or name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
        aria-label="Search catalog"
      />

      {error && entries.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={() => fetchEntries(search, page)}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : loading && entries.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-100 animate-pulse rounded-xl h-16" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">No catalog entries found.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => router.push(`/admin/catalog/${entry.id}`)}
              className="w-full text-left bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{entry.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{entry.barcode}</p>
                </div>
                {entry.category && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">
                    {entry.category}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
