'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardCheck } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'

/** Animated daily-checklist nudge.
 *
 *  Renders a small circular floating button in the bottom-LEFT corner,
 *  mirroring the New Sale FAB on the right. Pulses (expanding ring) so
 *  it's hard to miss until the owner taps it.
 *
 *  Mounted at the (app) layout level — the parent only renders it for
 *  owners on days where the checklist isn't yet complete, so this
 *  component just owns the visual + the path-based hide logic.
 *
 *  Hidden on /sale (the FAB is the priority there) and /checklist (we
 *  don't need to nudge the user back to the page they're already on).
 */
export function ChecklistReminderFab() {
  const pathname = usePathname()
  const { t } = useTranslation('checklist')

  const onSalePage = pathname === '/sale' || pathname.startsWith('/sale/')
  const onChecklistPage = pathname === '/checklist' || pathname.startsWith('/checklist/')
  if (onSalePage || onChecklistPage) return null

  return (
    <Link
      href="/checklist"
      aria-label={t('reminder_aria')}
      className="fixed z-30 left-4 w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center active:bg-amber-600 transition-colors"
      style={{ bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Two stacked pulse rings so the animation reads even on simple
          backgrounds. animate-ping is Tailwind's slow expanding ring. */}
      <span className="absolute inset-0 rounded-full bg-amber-400 opacity-75 animate-ping" />
      <span className="absolute inset-0 rounded-full bg-amber-400 opacity-50 animate-ping" style={{ animationDelay: '0.6s' }} />
      <ClipboardCheck className="w-6 h-6 relative" strokeWidth={2} />
    </Link>
  )
}
