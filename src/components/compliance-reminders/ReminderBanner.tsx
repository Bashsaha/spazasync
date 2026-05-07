'use client'

import { useTranslation } from '@/components/LanguageProvider'
import { DismissButton } from './DismissButton'
import type { Reminder, ReminderPriority } from '@/types'

const TONE: Record<ReminderPriority, { wrap: string; title: string; body: string }> = {
  urgent: {
    wrap: 'bg-red-50 border-red-200 border-l-4 border-l-red-500',
    title: 'text-red-900',
    body: 'text-red-700',
  },
  high: {
    wrap: 'bg-amber-50 border-amber-200 border-l-4 border-l-amber-500',
    title: 'text-amber-900',
    body: 'text-amber-800',
  },
  normal: {
    wrap: 'bg-blue-50 border-blue-200 border-l-4 border-l-blue-500',
    title: 'text-blue-900',
    body: 'text-blue-800',
  },
  low: {
    wrap: 'bg-gray-50 border-gray-200 border-l-4 border-l-gray-300',
    title: 'text-gray-900',
    body: 'text-gray-700',
  },
}

interface ReminderBannerProps {
  reminder: Reminder
}

export function ReminderBanner({ reminder }: ReminderBannerProps) {
  const { t } = useTranslation('compliance-reminders')
  const tone = TONE[reminder.priority]
  const isExternal = reminder.ctaHref?.startsWith('http') ?? false

  return (
    <div
      className={`${tone.wrap} border rounded-2xl p-4 mb-4`}
      role="status"
      aria-live="polite"
    >
      <p className={`font-semibold ${tone.title}`}>
        {t(reminder.titleKey, reminder.params)}
      </p>
      <p className={`text-sm mt-1 ${tone.body}`}>
        {t(reminder.bodyKey, reminder.params)}
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        {reminder.ctaKey && reminder.ctaHref && (
          <a
            href={reminder.ctaHref}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="flex-1 min-w-[160px] text-center bg-white border border-current/30 font-semibold py-2 px-4 rounded-xl text-sm active:bg-current/10"
          >
            {t(reminder.ctaKey, reminder.params)}
          </a>
        )}
        <DismissButton
          reminderKey={reminder.key}
          reminderType={reminder.type}
          className="px-4 py-2 bg-white border border-current/30 font-medium rounded-xl text-sm active:bg-current/10"
        />
      </div>
    </div>
  )
}
