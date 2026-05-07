'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminAlert } from '@/types'

const PRIORITY_BADGE: Record<AdminAlert['priority'], string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-amber-100 text-amber-700',
  normal: 'bg-blue-100 text-blue-700',
}

const AUDIENCE_LABEL: Record<AdminAlert['target_audience'], string> = {
  all: 'All shops',
  sa_citizen: 'SA citizens',
  foreign_national: 'Foreign nationals',
}

export default function AdminAlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<AdminAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/alerts')
      if (res.ok) {
        const data = await res.json()
        setAlerts(data.alerts)
      } else {
        setError('Failed to load alerts')
      }
    } catch {
      setError('Network error — check your connection')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  function isActive(a: AdminAlert): boolean {
    const now = Date.now()
    const start = new Date(a.starts_at).getTime()
    if (start > now) return false
    if (a.expires_at && new Date(a.expires_at).getTime() <= now) return false
    return true
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Broadcast Alerts</h1>
        <button
          onClick={() => router.push('/admin/alerts/new')}
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          New alert
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Broadcasts shown as in-app banners on the dashboard. Active alerts surface
        only when within the start/expiry window. Dismissing an alert is per-shop —
        once a shop dismisses, it stays dismissed until you publish a new one.
      </p>

      {error && alerts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button onClick={fetchAlerts} className="text-sm font-medium text-blue-600 hover:underline">
            Retry
          </button>
        </div>
      ) : loading && alerts.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-gray-100 animate-pulse rounded-xl h-20" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">No alerts published yet.</p>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <button
              key={a.id}
              onClick={() => router.push(`/admin/alerts/${a.id}`)}
              className="w-full text-left bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{a.title}</p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.message}</p>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[a.priority]}`}>
                      {a.priority}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {AUDIENCE_LABEL[a.target_audience]}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-medium ${
                        isActive(a)
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {isActive(a) ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
