'use client'

import { useState } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import { useRouter } from 'next/navigation'
import { emitDataChanged } from '@/lib/events'
import type { ReminderType } from '@/types'

interface DismissButtonProps {
  reminderKey: string
  reminderType: ReminderType
  /** Tailwind classes for the button — let parent decide colour. */
  className?: string
}

export function DismissButton({
  reminderKey,
  reminderType,
  className,
}: DismissButtonProps) {
  const { t } = useTranslation('compliance-reminders')
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  async function handleClick() {
    setBusy(true)
    try {
      await fetch('/api/compliance-reminders/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminder_key: reminderKey,
          reminder_type: reminderType,
        }),
      })
    } catch {
      /* swallow — banner will re-render next dashboard load anyway */
    }
    setHidden(true)
    emitDataChanged()
    // Refresh the route so the server component picks up the dismissed state
    // and renders the next-priority reminder (or nothing).
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={
        className ??
        'text-sm text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 active:bg-gray-100 disabled:opacity-50'
      }
      aria-label={t('cta_dismiss')}
    >
      {t('cta_dismiss')}
    </button>
  )
}
