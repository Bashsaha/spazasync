'use client'

/**
 * Phase 41e — Admin dashboard widget for compliance-facts verification cadence.
 *
 * Shows "Last verified: {date} ({N} days ago)" with a "Mark verification
 * complete" button. When N >= 30 (cadence per tasks/compliance-facts-audit.md)
 * the card turns red with an urgent alert tone.
 *
 * The audit work itself is done OUTSIDE this widget — the dev/admin opens
 * Claude in the codebase and runs the manual audit process documented in
 * tasks/compliance-facts-audit.md. This widget is only the bookkeeping +
 * alert surface.
 */

import { useEffect, useState } from 'react'
import { CalendarCheck, ShieldAlert, ShieldCheck } from 'lucide-react'

interface LatestResponse {
  latest: {
    id: string
    verified_at: string
    phase: string | null
    notes: string | null
  } | null
  daysSince: number | null
  overdue: boolean
}

function formatDate(iso: string): string {
  // Display as YYYY-MM-DD — short, unambiguous, matches the audit doc style.
  return iso.slice(0, 10)
}

export function ComplianceVerificationWidget() {
  const [data, setData] = useState<LatestResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState('')
  const [notes, setNotes] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/compliance-verification')
      if (!res.ok) throw new Error('Failed to load')
      setData((await res.json()) as LatestResponse)
    } catch {
      setError('Could not load verification log.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function markDone() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/compliance-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: phase.trim() || `manual-${new Date().toISOString().slice(0, 10)}`,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to record')
      setPhase('')
      setNotes('')
      setShowForm(false)
      await load()
    } catch {
      setError('Could not record verification.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="border rounded-2xl p-4 bg-gray-50 border-gray-200 animate-pulse">
        <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
        <div className="h-6 w-56 bg-gray-200 rounded" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="border rounded-2xl p-4 bg-red-50 border-red-200 text-red-800 text-sm">
        {error ?? 'Could not load compliance verification log.'}
      </div>
    )
  }

  const { latest, daysSince, overdue } = data
  const tone = overdue
    ? { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-800', icon: 'text-red-700' }
    : daysSince !== null && daysSince >= 21
      ? { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800', icon: 'text-amber-700' }
      : { border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-800', icon: 'text-green-700' }

  const Icon = overdue ? ShieldAlert : daysSince !== null && daysSince >= 21 ? CalendarCheck : ShieldCheck

  return (
    <div className={`border rounded-2xl p-4 ${tone.bg} ${tone.border}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-6 h-6 shrink-0 mt-0.5 ${tone.icon}`} strokeWidth={1.75} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wide ${tone.text} opacity-80`}>
            Compliance facts verification
          </p>
          {latest ? (
            <>
              <p className={`text-lg font-bold ${tone.text}`}>
                {overdue ? (
                  <>Overdue by {(daysSince ?? 0) - 30} days</>
                ) : daysSince === 0 ? (
                  <>Verified today</>
                ) : (
                  <>{daysSince} day{daysSince === 1 ? '' : 's'} ago</>
                )}
              </p>
              <p className={`text-xs mt-1 ${tone.text} opacity-90`}>
                Last verified: {formatDate(latest.verified_at)}
                {latest.phase ? ` · ${latest.phase}` : ''}
              </p>
              <p className={`text-xs mt-2 ${tone.text} opacity-75`}>
                Cadence: every 30 days. Run the manual audit via Claude in the codebase against{' '}
                <code className="text-[11px]">tasks/compliance-facts-audit.md</code>, then record below.
              </p>
            </>
          ) : (
            <p className={`text-lg font-bold ${tone.text}`}>No verification recorded yet</p>
          )}

          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mt-2">
              {error}
            </p>
          )}

          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-3 inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-800 text-xs font-bold rounded-full active:bg-gray-50"
            >
              Mark verification complete
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                placeholder="Phase or label (e.g. 41e, manual-2026-06-16)"
                className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white"
                maxLength={100}
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional) — what changed, what was confirmed correct, what follow-up phase opened"
                className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white min-h-[80px]"
                maxLength={1000}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={markDone}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-brand text-white text-xs font-bold rounded-full active:bg-brand-hover disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Record verification'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setPhase(''); setNotes('') }}
                  disabled={submitting}
                  className="px-4 py-2 text-xs text-gray-600 active:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
