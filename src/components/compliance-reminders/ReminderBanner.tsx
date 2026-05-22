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
    wrap: 'bg-brand-light border-brand-light border-l-4 border-l-brand',
    title: 'text-brand-hover',
    body: 'text-brand-hover',
  },
  low: {
    wrap: 'bg-gray-50 border-gray-200 border-l-4 border-l-gray-300',
    title: 'text-gray-900',
    body: 'text-gray-700',
  },
}

interface ReminderBannerProps {
  reminder: Reminder
  title: string
  body: string
  ctaLabel?: string
}

/**
 * Reminders are NOT dismissible by design — they reflect a required task and
 * are recomputed from live data on every load, so each one disappears on its
 * own the moment the underlying issue is resolved (step completed, document
 * renewed, count back to zero, etc.). Hiding a still-outstanding task would
 * just bury work that still has to happen, so there's no Dismiss control.
 */
export function ReminderBanner({ reminder, title, body, ctaLabel }: ReminderBannerProps) {
  const tone = TONE[reminder.priority]
  const isExternal = reminder.ctaHref?.startsWith('http') ?? false

  return (
    <div
      className={`${tone.wrap} border rounded-2xl p-4 mb-4`}
      role="status"
      aria-live="polite"
    >
      <p className={`font-semibold ${tone.title}`}>{title}</p>
      <p className={`text-sm mt-1 ${tone.body}`}>{body}</p>
      {ctaLabel && reminder.ctaHref && (
        <div className="mt-3">
          <a
            href={reminder.ctaHref}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="inline-block text-center bg-white border border-current/30 font-semibold py-2 px-4 rounded-full text-sm active:bg-current/10"
          >
            {ctaLabel}
          </a>
        </div>
      )}
    </div>
  )
}
