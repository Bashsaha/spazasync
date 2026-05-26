'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ClipboardCheck } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible'

const INTRO_SEEN_KEY = 'mvs_checklist_intro_seen'

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
 *  First-time tap shows a one-off explainer bottom sheet — once the owner
 *  taps "Got it" the flag in localStorage flips and future taps open the
 *  checklist directly. Dismissing the sheet (backdrop tap) does NOT set the
 *  flag so the explainer reappears next tap.
 *
 *  Hidden on /sale and /checklist.
 */
export function ChecklistReminderFab({ initialVisible }: { initialVisible: boolean }) {
  const [visible, setVisible] = useState(initialVisible)
  const [showIntro, setShowIntro] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation('checklist')

  const recheck = useCallback(async () => {
    try {
      const res = await fetch('/api/daily-checklist/status')
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

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    let seen = false
    try {
      seen = localStorage.getItem(INTRO_SEEN_KEY) === '1'
    } catch {
      // Private mode / quota — treat as seen so we never lock the user out.
      seen = true
    }
    if (seen) {
      router.push('/checklist')
    } else {
      setShowIntro(true)
    }
  }, [router])

  const handleGotIt = useCallback(() => {
    try {
      localStorage.setItem(INTRO_SEEN_KEY, '1')
    } catch {
      // ignore — the user will just see the intro again next time
    }
    setShowIntro(false)
    router.push('/checklist')
  }, [router])

  const onSalePage = pathname === '/sale' || pathname.startsWith('/sale/')
  const onChecklistPage = pathname === '/checklist' || pathname.startsWith('/checklist/')
  if (!visible || onSalePage || onChecklistPage) return null

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={t('reminder_aria')}
        className="fixed z-30 left-4 w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center active:bg-amber-600 transition-colors"
        style={{ bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Two stacked pulse rings so the animation reads even on simple backgrounds. */}
        <span className="absolute inset-0 rounded-full bg-amber-400 opacity-75 animate-ping" />
        <span className="absolute inset-0 rounded-full bg-amber-400 opacity-50 animate-ping" style={{ animationDelay: '0.6s' }} />
        <ClipboardCheck className="w-6 h-6 relative" strokeWidth={2} />
      </button>

      {showIntro && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowIntro(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-3">
              <ClipboardCheck className="w-5 h-5 text-amber-600" strokeWidth={2} />
            </div>
            <p className="text-gray-900 font-bold text-lg mb-2">
              {t('intro_title')}
            </p>
            <p className="text-gray-700 text-sm mb-2">{t('intro_body')}</p>
            <p className="text-gray-500 text-sm mb-6">{t('intro_why')}</p>
            <button
              type="button"
              onClick={handleGotIt}
              autoFocus
              className="w-full py-3 rounded-full font-semibold text-white bg-brand active:bg-brand-hover"
            >
              {t('intro_got_it')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
