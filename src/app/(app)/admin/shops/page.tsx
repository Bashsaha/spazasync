'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Store } from 'lucide-react'
import type { AdminShopListItem, SubscriptionStatus } from '@/types'
import { statusBadgeColors } from '@/lib/utils/statusBadge'
import { Badge, EmptyState } from '@/components/ui'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
  { value: 'manual_override', label: 'Manual Override' },
]

export default function AdminShopsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(() => {
    const s = searchParams.get('status') ?? ''
    return STATUS_OPTIONS.some((o) => o.value === s) ? s : ''
  })
  const [page, setPage] = useState(1)
  const [shops, setShops] = useState<AdminShopListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const limit = 20

  const fetchShops = useCallback(async (s: string, st: string, p: number) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (s) params.set('search', s)
      if (st) params.set('status', st)
      params.set('page', String(p))
      params.set('limit', String(limit))

      const res = await fetch(`/api/admin/shops?${params}`)
      if (res.ok) {
        const data = await res.json()
        setShops(data.shops)
        setTotal(data.total)
      } else {
        setError('Failed to load shops')
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
      fetchShops(search, status, 1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, status, fetchShops])

  // Page changes (not debounced)
  useEffect(() => {
    if (page > 1) fetchShops(search, status, page)
  }, [page, search, status, fetchShops])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">All Shops</h1>
        {!loading && <Badge tone="gray">{total} {total === 1 ? 'shop' : 'shops'}</Badge>}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          aria-label="Search shops"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 rounded-2xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && shops.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={() => fetchShops(search, status, page)}
            className="text-sm font-medium text-brand hover:underline"
          >
            Retry
          </button>
        </div>
      ) : loading && shops.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-100 animate-pulse rounded-xl h-20" />
          ))}
        </div>
      ) : shops.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No shops found"
          body={search || status ? 'Try a different search or filter.' : 'No shops have signed up yet.'}
        />
      ) : (
        <div className="space-y-3">
          {shops.map((shop) => (
            <button
              key={shop.id}
              onClick={() => router.push(`/admin/shops/${shop.id}`)}
              className="w-full text-left bg-white border border-gray-100 rounded-2xl p-4 hover:border-brand-light hover:bg-brand-light/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{shop.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="font-mono">{shop.code}</span>
                    {shop.owner_email && (
                      <span> &middot; {shop.owner_email}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {shop.access_granted && (
                    <span className="text-green-500 text-xs font-medium">Access</span>
                  )}
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      statusBadgeColors[shop.subscription_status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {shop.subscription_status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-300 mt-2">
                Created {new Date(shop.created_at).toLocaleDateString()}
                {shop.last_payment_at && (
                  <span> &middot; Last payment {new Date(shop.last_payment_at).toLocaleDateString()}</span>
                )}
              </p>
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
            className="text-sm px-4 py-2 rounded-full border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="text-sm px-4 py-2 rounded-full border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
