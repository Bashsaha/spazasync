'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardCheck } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible'

/** Animated daily-checklist nudge.
 *
 *  Renders a small circular floating button in the bottom-LEFT corner.
 *  Pulses (expanding ring) until the owner taps it or completes the checklist.
 *
 *  `initialVisible` is the server-side hint — fastest path for first paint
 *  when the server-rendered HTML is current. We additionally run a status
 *  fetch on mount + every visibility event, and apply the result in BOTH
 *  directions (show + hide). This self-heals from stale-HTML scenarios like
 *  day-rollover where the cached render said "completed" but a new day means
 *  the checklist is now pending again. (BUG-040)
 *
 *  Hidden on /sale and /checklist.
 */
export function ChecklistReminderFab({ initialVisible }: { initialVisible: boolean }) {
  const [visible, setVisible] = useState(initialVisible)
  const pathname = usePathname()
  const { t } = useTranslation('checklist')

  const recheck = useCallback(async () => {
    try {
      const res = await fetch('/api/daily-checklist/status', { cache: 'no-store' })
      if (res.ok) {
        const { completed } = await res.json() as { completed: boolean }
        setVisible(!completed)
      }
    } catch {
      // silently ignore — keep current visibility until next check succeeds
    }
  }, [])

  // One-shot reconcile on mount so a stale `initialVisible` (e.g. from a
  // bfcache restore on a new day) corrects itself without waiting for a
  // visibility / focus event that may not fire on cold opens.
  useEffect(() => {
    recheck()
  }, [recheck])

  useRefetchOnVisible(recheck)

  const onSalePage = pathname === '/sale' || pathname.startsWith('/sale/')
  const onChecklistPage = pathname === '/checklist' || pathname.startsWith('/checklist/')
  if (!visible || onSalePage || onChecklistPage) return null

  return (
    <Link
      href="/checklist"
      aria-label={t('reminder_aria')}
      className="fixed z-30 left-4 w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center active:bg-amber-600 transition-colors"
      style={{ bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Two stacked pulse rings so the animation reads even on simple backgrounds. */}
      <span className="absolute inset-0 rounded-full bg-amber-400 opacity-75 animate-ping" />
      <span className="absolute inset-0 rounded-full bg-amber-400 opacity-50 animate-ping" style={{ animationDelay: '0.6s' }} />
      <ClipboardCheck className="w-6 h-6 relative" strokeWidth={2} />
    </Link>
  )
}
