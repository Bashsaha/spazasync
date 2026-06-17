'use client'

import { useState } from 'react'
import { FormField, Textarea, Select, Input, Button, Callout } from '@/components/ui'
import { VISIT_OUTCOME_LABELS, VISIT_OUTCOME_ORDER } from './meta'
import type { VisitOutcome } from '@/types'

export interface LogVisitValues {
  notes: string
  outcome: VisitOutcome | ''
  next_follow_up_at: string
  next_follow_up_note: string
}

interface LogVisitFormProps {
  /** Pre-fill the follow-up fields from the lead's current reminder. */
  initialFollowUpAt?: string | null
  initialFollowUpNote?: string | null
  onSubmit: (values: LogVisitValues) => Promise<void>
}

/** Inline "log a visit" form on the lead detail page. */
export default function LogVisitForm({
  initialFollowUpAt,
  initialFollowUpNote,
  onSubmit,
}: LogVisitFormProps) {
  const [values, setValues] = useState<LogVisitValues>({
    notes: '',
    outcome: '',
    next_follow_up_at: initialFollowUpAt ?? '',
    next_follow_up_note: initialFollowUpNote ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof LogVisitValues>(key: K, v: LogVisitValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSubmit(values)
      setValues({
        notes: '',
        outcome: '',
        next_follow_up_at: values.next_follow_up_at,
        next_follow_up_note: values.next_follow_up_note,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the visit.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Callout tone="error">{error}</Callout>}

      <FormField label="What happened?">
        <Textarea
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="e.g. Spoke to the owner, showed them the app, they want to think about it."
        />
      </FormField>

      <FormField label="Outcome">
        <Select
          value={values.outcome}
          onChange={(e) => set('outcome', e.target.value as VisitOutcome | '')}
        >
          <option value="">— Select —</option>
          {VISIT_OUTCOME_ORDER.map((o) => (
            <option key={o} value={o}>
              {VISIT_OUTCOME_LABELS[o]}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Follow up on" hint="Leave blank if no follow-up needed.">
          <Input
            type="date"
            value={values.next_follow_up_at}
            onChange={(e) => set('next_follow_up_at', e.target.value)}
          />
        </FormField>
        <FormField label="Follow-up reminder">
          <Input
            value={values.next_follow_up_note}
            onChange={(e) => set('next_follow_up_note', e.target.value)}
            placeholder="e.g. Bring price list"
          />
        </FormField>
      </div>

      <Button type="submit" loading={saving} fullWidth>
        Save visit
      </Button>
    </form>
  )
}
