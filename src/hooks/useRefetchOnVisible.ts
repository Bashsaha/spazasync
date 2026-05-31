import { useEffect, useRef } from 'react'
import { DATA_CHANGED, RESUME_READY } from '@/lib/events'

/**
 * Throttle window for passive (resume) triggers. A user flicking between
 * Movestock and WhatsApp can fire several resume signals in quick succession;
 * without a guard the page would re-fetch each time. DATA_CHANGED bypasses this
 * gate because it represents a known mutation that needs fresh data NOW.
 */
const PASSIVE_REFETCH_MIN_MS = 10_000

/**
 * Runs `onVisible` when:
 *   - <ResumeGuard> broadcasts RESUME_READY — i.e. the app has returned to the
 *     foreground AND the connection is confirmed up AND the Supabase session has
 *     been refreshed if it was near expiry. We deliberately DON'T listen to raw
 *     `visibilitychange`/`focus`/`pageshow` anymore: firing a passive
 *     `router.refresh()` (a full RSC re-render that re-runs Server Component
 *     auth + DB queries) into a still-suspended radio / expired token was the
 *     resume-from-background crash + "tab won't load" cause (BUG-048/BUG-049).
 *     ResumeGuard gates all of that, so by the time RESUME_READY fires it's safe.
 *   - a mutation broadcasts the custom DATA_CHANGED event (fires immediately).
 *
 * RESUME_READY refreshes are throttled to once every 10s (PASSIVE_REFETCH_MIN_MS).
 * DATA_CHANGED always fires immediately and resets the throttle window.
 *
 * Pair with a `useCallback`-wrapped fetcher so the listener is stable.
 */
export function useRefetchOnVisible(onVisible: () => void) {
  const lastCallRef = useRef(0)

  useEffect(() => {
    function handleResumeReady() {
      // Belt-and-braces: ResumeGuard only emits when online, but guard anyway.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      const now = Date.now()
      if (now - lastCallRef.current < PASSIVE_REFETCH_MIN_MS) return
      lastCallRef.current = now
      onVisible()
    }
    function handleDataChanged() {
      // Known mutation — always refetch immediately and reset the throttle so a
      // resume trigger doesn't fire a redundant call seconds later.
      lastCallRef.current = Date.now()
      onVisible()
    }

    window.addEventListener(RESUME_READY, handleResumeReady)
    window.addEventListener(DATA_CHANGED, handleDataChanged)
    return () => {
      window.removeEventListener(RESUME_READY, handleResumeReady)
      window.removeEventListener(DATA_CHANGED, handleDataChanged)
    }
  }, [onVisible])
}
