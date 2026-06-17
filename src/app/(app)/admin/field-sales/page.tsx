'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, MapPin, Bell, Store } from 'lucide-react'
import {
  PageHeader,
  Card,
  LinkButton,
  Input,
  Select,
  Badge,
  EmptyState,
  Callout,
} from '@/components/ui'
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONES,
  LEAD_STATUS_ORDER,
} from '@/components/admin/field-sales/meta'
import type { LeadListItem } from '@/types'

function LeadRow({ lead }: { lead: LeadListItem }) {
  return (
    <Link
      href={`/admin/field-sales/${lead.id}`}
      className="block active:bg-gray-50 rounded-2xl border border-line bg-white p-4 min-h-touch"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{lead.business_name}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {lead.owner_name && <span>{lead.owner_name}</span>}
            {lead.area && <span>{lead.owner_name ? ' · ' : ''}{lead.area}</span>}
            {!lead.owner_name && !lead.area && <span className="text-gray-400">No contact yet</span>}
          </p>
        </div>
        <Badge tone={LEAD_STATUS_TONES[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        <span>{lead.visit_count} {lead.visit_count === 1 ? 'visit' : 'visits'}</span>
        {lead.last_visited_at && (
          <span>· Last {new Date(lead.last_visited_at).toLocaleDateString()}</span>
        )}
        {lead.shop_id && <span className="text-green-600">· On Movestock</span>}
      </div>
    </Link>
  )
}

export default function FieldSalesHubPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [area, setArea] = useState('')
  const [leads, setLeads] = useState<LeadListItem[]>([])
  const [dueFollowUps, setDueFollowUps] = useState<LeadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Pick up ?area= when arriving from the area view (read once on mount).
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get('area')
    if (a) setArea(a)
  }, [])

  const fetchLeads = useCallback(async (s: string, st: string, ar: string) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (s) params.set('search', s)
      if (st) params.set('status', st)
      if (ar) params.set('area', ar)
      params.set('limit', '100')
      const res = await fetch(`/api/admin/field-sales/leads?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLeads(data.leads)
      } else {
        setError('Failed to load shops')
      }
    } catch {
      setError('Network error — check your connection')
    } finally {
      setLoading(false)
    }
  }, [])

  // Follow-ups load once (not filtered).
  useEffect(() => {
    fetch('/api/admin/field-sales/follow-ups')
      .then((r) => (r.ok ? r.json() : { leads: [] }))
      .then((d) => setDueFollowUps(d.leads ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchLeads(search, status, area), 300)
    return () => clearTimeout(t)
  }, [search, status, area, fetchLeads])

  return (
    <div>
      <PageHeader
        title="Field sales"
        subtitle="Shops you're selling to and visiting"
        action={
          <LinkButton href="/admin/field-sales/new" icon={Plus} size="sm">
            Add shop
          </LinkButton>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <LinkButton href="/admin/field-sales/areas" variant="outline" size="sm" icon={MapPin}>
          By area
        </LinkButton>
        {area && (
          <button
            onClick={() => setArea('')}
            className="inline-flex items-center gap-1 rounded-full bg-brand-light text-brand-dark text-xs font-medium px-3 py-1.5"
          >
            Area: {area} ✕
          </button>
        )}
      </div>

      {/* Follow-ups due */}
      {dueFollowUps.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-amber-600" aria-hidden />
            <h2 className="text-sm font-semibold text-gray-900">
              Follow-ups due ({dueFollowUps.length})
            </h2>
          </div>
          <div className="space-y-2">
            {dueFollowUps.map((lead) => (
              <Link
                key={lead.id}
                href={`/admin/field-sales/${lead.id}`}
                className="block active:bg-amber-100 rounded-2xl border border-amber-200 bg-amber-50 p-3 min-h-touch"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-amber-900 truncate">{lead.business_name}</p>
                    {lead.next_follow_up_note && (
                      <p className="text-xs text-amber-800 truncate">{lead.next_follow_up_note}</p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-amber-700 shrink-0">
                    {lead.next_follow_up_at &&
                      new Date(lead.next_follow_up_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          type="search"
          placeholder="Search name, owner or area…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search shops"
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="sm:w-48"
        >
          <option value="">All statuses</option>
          {LEAD_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <Callout tone="error">{error}</Callout>
      ) : loading && leads.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-100 animate-pulse rounded-2xl h-20" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No shops yet"
          body="Add the first shop you've visited to start tracking your sales rounds."
          action={
            <LinkButton href="/admin/field-sales/new" icon={Plus}>
              Add shop
            </LinkButton>
          }
        />
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <LeadRow key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  )
}
