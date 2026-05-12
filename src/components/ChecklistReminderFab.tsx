'use client'

import { useState, useCallback } from 'react'
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
 *  `initialVisible` comes from the server-side layout render. After any
 *  DATA_CHANGED event (e.g. checklist saved) the component re-checks the
 *  status API so it dismisses itself without waiting for router.refresh().
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
        if (completed) setVisible(false)
      }
    } catch {
      // silently ignore — FAB stays visible until next check
    }
  }, [])

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
