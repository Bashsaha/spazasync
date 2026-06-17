// Field Sales — presentational label + badge-tone maps (English-only, matching
// the admin-portal precedent of no i18n). Pure, client-safe.

import type { BadgeTone } from '@/components/ui'
import type { LeadStatus, VisitOutcome } from '@/types'

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  prospect: 'Prospect',
  contacted: 'Contacted',
  interested: 'Interested',
  signed: 'Signed up',
  not_interested: 'Not interested',
}

export const LEAD_STATUS_TONES: Record<LeadStatus, BadgeTone> = {
  prospect: 'gray',
  contacted: 'blue',
  interested: 'amber',
  signed: 'green',
  not_interested: 'red',
}

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'prospect',
  'contacted',
  'interested',
  'signed',
  'not_interested',
]

export const VISIT_OUTCOME_LABELS: Record<VisitOutcome, string> = {
  left_info: 'Left info / flyer',
  demo_given: 'Showed the app',
  callback: 'Wants a callback',
  signed: 'Signed up',
  not_interested: 'Not interested',
  no_answer: 'No answer / closed',
  other: 'Other',
}

export const VISIT_OUTCOME_ORDER: VisitOutcome[] = [
  'left_info',
  'demo_given',
  'callback',
  'signed',
  'not_interested',
  'no_answer',
  'other',
]
