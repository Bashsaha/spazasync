'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPin } from 'lucide-react'
import { PageHeader, Card, Badge, EmptyState, Callout } from '@/components/ui'
import type { AreaGroup } from '@/types'

export default function FieldSalesAreasPage() {
  const [areas, setAreas] = useState<AreaGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/field-sales/areas')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setAreas(d.areas ?? []))
      .catch(() => setError('Failed to load areas'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <Link
        href="/admin/field-sales"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden /> Back
      </Link>
      <PageHeader title="By area" subtitle="Where your shops are and how many you've visited" />

      {error ? (
        <Callout tone="error">{error}</Callout>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-gray-100 animate-pulse rounded-2xl h-20" />
          ))}
        </div>
      ) : areas.length === 0 ? (
        <EmptyState icon={MapPin} title="No areas yet" body="Add shops with an area to see them grouped here." />
      ) : (
        <div className="space-y-3">
          {areas.map((a) => (
            <Link
              key={a.area}
              href={`/admin/field-sales?area=${encodeURIComponent(a.area)}`}
              className="block active:bg-gray-50 rounded-2xl border border-line bg-white p-4 min-h-touch"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-gray-900 flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
                  <span className="truncate">{a.area}</span>
                </p>
                <Badge tone="brand">{a.total} {a.total === 1 ? 'shop' : 'shops'}</Badge>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span>{a.visited} visited</span>
                <span>· {a.signed} signed up</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
