'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Phone, MessageCircle, Pencil, Trash2, MapPin } from 'lucide-react'
import {
  PageHeader,
  Card,
  SectionHeader,
  Badge,
  Button,
  Callout,
  EmptyState,
} from '@/components/ui'
import LeadForm, { type LeadFormValues } from '@/components/admin/field-sales/LeadForm'
import LogVisitForm, { type LogVisitValues } from '@/components/admin/field-sales/LogVisitForm'
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONES,
  VISIT_OUTCOME_LABELS,
} from '@/components/admin/field-sales/meta'
import type { LeadDetail } from '@/types'

/** Strip a SA phone number to wa.me digits (drop +, spaces; 0xx → 27xx). */
function waLink(num: string): string {
  let d = num.replace(/[^\d]/g, '')
  if (d.startsWith('0')) d = '27' + d.slice(1)
  return `https://wa.me/${d}`
}

export default function LeadDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/field-sales/leads/${id}`)
    if (res.status === 404) {
      setNotFound(true)
      setLoading(false)
      return
    }
    if (res.ok) {
      const { lead } = await res.json()
      setLead(lead)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function saveEdit(values: LeadFormValues) {
    const res = await fetch(`/api/admin/field-sales/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!res.ok) throw new Error('Could not save changes.')
    await load()
    setEditing(false)
  }

  async function logVisit(values: LogVisitValues) {
    const res = await fetch(`/api/admin/field-sales/leads/${id}/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: values.notes,
        outcome: values.outcome || undefined,
        next_follow_up_at: values.next_follow_up_at || '',
        next_follow_up_note: values.next_follow_up_note,
      }),
    })
    if (!res.ok) throw new Error('Could not save the visit.')
    await load()
  }

  async function handleDelete() {
    if (!confirm('Delete this shop and all its visits? This cannot be undone.')) return
    setDeleting(true)
    const res = await fetch(`/api/admin/field-sales/leads/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/admin/field-sales')
    } else {
      setDeleting(false)
      alert('Could not delete. Try again.')
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="bg-gray-100 animate-pulse rounded-2xl h-24" />
        <div className="bg-gray-100 animate-pulse rounded-2xl h-40" />
      </div>
    )
  }

  if (notFound || !lead) {
    return (
      <EmptyState
        title="Shop not found"
        body="It may have been deleted."
        action={
          <Link href="/admin/field-sales" className="text-sm font-medium text-brand">
            Back to field sales
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <Link
        href="/admin/field-sales"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden /> Back
      </Link>

      <PageHeader
        title={lead.business_name}
        subtitle={lead.owner_name ?? undefined}
        action={<Badge tone={LEAD_STATUS_TONES[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>}
      />

      {editing ? (
        <Card padding="lg" className="mb-6">
          <SectionHeader
            title="Edit shop"
            className="mb-4"
            action={
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            }
          />
          <LeadForm lead={lead} submitLabel="Save changes" onSubmit={saveEdit} />
        </Card>
      ) : (
        <>
          {/* Contact + quick actions */}
          <Card className="mb-4">
            <div className="space-y-1.5 text-sm">
              {lead.area && (
                <p className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400" aria-hidden /> {lead.area}
                </p>
              )}
              {lead.address && <p className="text-gray-600">{lead.address}</p>}
              {lead.phone && <p className="text-gray-600">Phone: {lead.phone}</p>}
              {lead.whatsapp_number && <p className="text-gray-600">WhatsApp: {lead.whatsapp_number}</p>}
              {lead.shop_id && (
                <p className="text-green-600 font-medium">✓ Linked to a Movestock shop</p>
              )}
              {lead.notes && <p className="text-gray-500 pt-2 whitespace-pre-wrap">{lead.notes}</p>}
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              {lead.phone && (
                <a
                  href={`tel:${lead.phone.replace(/\s/g, '')}`}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-light text-brand-dark text-sm font-semibold px-4 py-2 min-h-[44px] active:bg-brand-light/80"
                >
                  <Phone className="w-4 h-4" aria-hidden /> Call
                </a>
              )}
              {lead.whatsapp_number && (
                <a
                  href={waLink(lead.whatsapp_number)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-green-100 text-green-800 text-sm font-semibold px-4 py-2 min-h-[44px] active:bg-green-200"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden /> WhatsApp
                </a>
              )}
              <Button variant="outline" size="md" icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
            </div>
          </Card>

          {/* Log a visit */}
          <Card padding="lg" className="mb-6">
            <SectionHeader title="Log a visit" className="mb-4" />
            <LogVisitForm
              initialFollowUpAt={lead.next_follow_up_at}
              initialFollowUpNote={lead.next_follow_up_note}
              onSubmit={logVisit}
            />
          </Card>

          {/* Visit history */}
          <SectionHeader title={`Visit history (${lead.visits.length})`} className="mb-3" />
          {lead.visits.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No visits logged yet.</p>
          ) : (
            <div className="space-y-3">
              {lead.visits.map((v) => (
                <Card key={v.id} padding="md">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(v.visited_at).toLocaleDateString()}
                    </span>
                    {v.outcome && <Badge tone="gray">{VISIT_OUTCOME_LABELS[v.outcome]}</Badge>}
                  </div>
                  {v.notes && <p className="text-sm text-gray-600 whitespace-pre-wrap">{v.notes}</p>}
                </Card>
              ))}
            </div>
          )}

          {/* Danger zone */}
          <div className="mt-8 pt-6 border-t border-line">
            <Button
              variant="destructive"
              size="sm"
              icon={Trash2}
              loading={deleting}
              onClick={handleDelete}
            >
              Delete shop
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
