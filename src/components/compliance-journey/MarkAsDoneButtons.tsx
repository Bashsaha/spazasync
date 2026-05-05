'use client'

/**
 * Phase 37c — action row at the bottom of every step card.
 *
 * Three actions:
 *   • "Mark as done" — for steps that don't have a clear "applied" → "received"
 *     workflow (e.g. SMMESA registration where you create an account and you're
 *     done in one sitting). Goes straight to status='valid'.
 *   • "I've applied" — opens an inline reference-number input. POSTs with
 *     status='in_progress'. The card moves to 🟡.
 *   • "I've received" — visible only after "I've applied". Opens reference +
 *     issue/expiry date inputs. POSTs with status='valid'.
 *
 * After any successful action we refresh the page (router.refresh()) so the
 * step list re-renders with the new status from the server.
 */

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import type { ComplianceJourneyStep, JourneyStepAction } from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  step: ComplianceJourneyStep
  variant?: 'standard' | 'one_shot'
  hasExpiry?: boolean
}

export function MarkAsDoneButtons({
  step,
  variant = 'standard',
  hasExpiry = false,
}: Props) {
  const { t } = useTranslation('compliance-journey')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [openForm, setOpenForm] = useState<JourneyStepAction | null>(null)
  const [refNumber, setRefNumber] = useState('')
  const [dateIssued, setDateIssued] = useState('')
  const [expiry, setExpiry] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(action: JourneyStepAction) {
    setError(null)
    const body: Record<string, unknown> = {
      document_type: step.key,
      action,
    }
    if (action === 'mark_applied' || action === 'mark_received') {
      if (refNumber.trim()) body.reference_number = refNumber.trim()
    }
    if (action === 'mark_received') {
      if (dateIssued) body.date_issued = dateIssued
      if (expiry) body.expiry_date = expiry
    }

    const res = await fetch('/api/compliance/journey/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null
      setError(j?.error ?? t('action_error_generic'))
      return
    }
    setOpenForm(null)
    setRefNumber('')
    setDateIssued('')
    setExpiry('')
    startTransition(() => router.refresh())
  }

  // "I've received" form — used after "I've applied" or directly when needed.
  if (openForm === 'mark_received') {
    return (
      <ReceiveForm
        t={t}
        refNumber={refNumber}
        setRefNumber={setRefNumber}
        dateIssued={dateIssued}
        setDateIssued={setDateIssued}
        expiry={expiry}
        setExpiry={setExpiry}
        hasExpiry={hasExpiry}
        error={error}
        isPending={isPending}
        onCancel={() => {
          setOpenForm(null)
          setError(null)
        }}
        onSubmit={() => submit('mark_received')}
      />
    )
  }

  if (openForm === 'mark_applied') {
    return (
      <ApplyForm
        t={t}
        refNumber={refNumber}
        setRefNumber={setRefNumber}
        error={error}
        isPending={isPending}
        onCancel={() => {
          setOpenForm(null)
          setError(null)
        }}
        onSubmit={() => submit('mark_applied')}
      />
    )
  }

  // ── Default action row ─────────────────────────────────────────────
  if (step.status === 'complete') {
    return (
      <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-3">
        <p className="text-sm text-green-800 font-medium">
          {t('action_complete_label')}
        </p>
        <button
          type="button"
          onClick={() => submit('reset')}
          disabled={isPending}
          className="text-xs text-gray-500 active:text-gray-700 underline"
        >
          {t('action_reset')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {step.status === 'in_progress' ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpenForm('mark_received')}
            disabled={isPending}
            className="flex-1 min-w-[140px] px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg active:bg-green-700"
          >
            {t('action_received')} ✓
          </button>
          <button
            type="button"
            onClick={() => submit('reset')}
            disabled={isPending}
            className="px-3 py-2.5 text-xs text-gray-500 active:text-gray-700 underline"
          >
            {t('action_reset')}
          </button>
        </div>
      ) : variant === 'one_shot' ? (
        <button
          type="button"
          onClick={() => submit('mark_done')}
          disabled={isPending}
          className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg active:bg-blue-700"
        >
          {t('action_mark_done')}
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpenForm('mark_applied')}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 bg-amber-500 text-white text-sm font-bold rounded-lg active:bg-amber-600"
          >
            {t('action_applied')} →
          </button>
          <button
            type="button"
            onClick={() => setOpenForm('mark_received')}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg active:bg-green-700"
          >
            {t('action_received')} ✓
          </button>
        </div>
      )}
    </div>
  )
}

function ApplyForm({
  t,
  refNumber,
  setRefNumber,
  error,
  isPending,
  onCancel,
  onSubmit,
}: {
  t: T
  refNumber: string
  setRefNumber: (v: string) => void
  error: string | null
  isPending: boolean
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3"
    >
      <label className="block text-sm">
        <span className="text-gray-800 font-medium">
          {t('form_applied_ref_label')}
        </span>
        <input
          type="text"
          value={refNumber}
          onChange={(e) => setRefNumber(e.target.value)}
          placeholder={t('form_applied_ref_placeholder')}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-base"
          autoFocus
        />
      </label>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 px-4 py-2.5 bg-amber-500 text-white text-sm font-bold rounded-lg active:bg-amber-600"
        >
          {t('btn_save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-4 py-2.5 text-sm text-gray-600 active:text-gray-800"
        >
          {t('btn_cancel')}
        </button>
      </div>
    </form>
  )
}

function ReceiveForm({
  t,
  refNumber,
  setRefNumber,
  dateIssued,
  setDateIssued,
  expiry,
  setExpiry,
  hasExpiry,
  error,
  isPending,
  onCancel,
  onSubmit,
}: {
  t: T
  refNumber: string
  setRefNumber: (v: string) => void
  dateIssued: string
  setDateIssued: (v: string) => void
  expiry: string
  setExpiry: (v: string) => void
  hasExpiry: boolean
  error: string | null
  isPending: boolean
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-3"
    >
      <label className="block text-sm">
        <span className="text-gray-800 font-medium">
          {t('form_received_ref_label')}
        </span>
        <input
          type="text"
          value={refNumber}
          onChange={(e) => setRefNumber(e.target.value)}
          placeholder={t('form_received_ref_placeholder')}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-base"
          autoFocus
          required
        />
      </label>
      <label className="block text-sm">
        <span className="text-gray-800 font-medium">
          {t('form_received_issued_label')}
        </span>
        <input
          type="date"
          value={dateIssued}
          onChange={(e) => setDateIssued(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-base"
        />
      </label>
      {hasExpiry && (
        <label className="block text-sm">
          <span className="text-gray-800 font-medium">
            {t('form_received_expiry_label')}
          </span>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-base"
          />
        </label>
      )}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg active:bg-green-700"
        >
          {t('btn_save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-4 py-2.5 text-sm text-gray-600 active:text-gray-800"
        >
          {t('btn_cancel')}
        </button>
      </div>
    </form>
  )
}
