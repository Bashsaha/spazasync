'use client'

import { useState } from 'react'
import { FormField, Input, Textarea, Select, Button, Callout } from '@/components/ui'
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER } from './meta'
import type { Lead, LeadStatus } from '@/types'

export interface LeadFormValues {
  business_name: string
  owner_name: string
  phone: string
  whatsapp_number: string
  address: string
  area: string
  status: LeadStatus
  notes: string
}

function initialValues(lead?: Lead): LeadFormValues {
  return {
    business_name: lead?.business_name ?? '',
    owner_name: lead?.owner_name ?? '',
    phone: lead?.phone ?? '',
    whatsapp_number: lead?.whatsapp_number ?? '',
    address: lead?.address ?? '',
    area: lead?.area ?? '',
    status: lead?.status ?? 'prospect',
    notes: lead?.notes ?? '',
  }
}

interface LeadFormProps {
  lead?: Lead
  submitLabel: string
  onSubmit: (values: LeadFormValues) => Promise<void>
}

/** Shared create/edit form for a lead. Used by /new and the detail edit panel. */
export default function LeadForm({ lead, submitLabel, onSubmit }: LeadFormProps) {
  const [values, setValues] = useState<LeadFormValues>(() => initialValues(lead))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof LeadFormValues>(key: K, v: LeadFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.business_name.trim()) {
      setError('Shop / business name is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Callout tone="error">{error}</Callout>}

      <FormField label="Shop / business name" required>
        <Input
          value={values.business_name}
          onChange={(e) => set('business_name', e.target.value)}
          placeholder="e.g. Thabo's Spaza"
          autoFocus
        />
      </FormField>

      <FormField label="Owner / contact name">
        <Input
          value={values.owner_name}
          onChange={(e) => set('owner_name', e.target.value)}
          placeholder="Who you spoke to"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Phone">
          <Input
            type="tel"
            inputMode="tel"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="071 234 5678"
          />
        </FormField>
        <FormField label="WhatsApp">
          <Input
            type="tel"
            inputMode="tel"
            value={values.whatsapp_number}
            onChange={(e) => set('whatsapp_number', e.target.value)}
            placeholder="071 234 5678"
          />
        </FormField>
      </div>

      <FormField label="Area / township" hint="Used to group shops on the area view.">
        <Input
          value={values.area}
          onChange={(e) => set('area', e.target.value)}
          placeholder="e.g. Khayelitsha"
        />
      </FormField>

      <FormField label="Address">
        <Input
          value={values.address}
          onChange={(e) => set('address', e.target.value)}
          placeholder="Street / directions"
        />
      </FormField>

      <FormField label="Status">
        <Select value={values.status} onChange={(e) => set('status', e.target.value as LeadStatus)}>
          {LEAD_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Notes">
        <Textarea
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Anything worth remembering about this shop"
        />
      </FormField>

      <Button type="submit" loading={saving} fullWidth size="lg">
        {submitLabel}
      </Button>
    </form>
  )
}
