import { useEffect, useRef } from 'react'
import { DATA_CHANGED } from '@/lib/events'

/**
 * Throttle window for passive triggers (visibilitychange / focus / pageshow).
 * Android fires these aggressively when the user pulls down the notification
 * shade, gets a WhatsApp popup, or switches apps — without a guard the page
 * would re-fetch dozens of times per hour. DATA_CHANGED bypasses this gate
 * because it represents a known user mutation that needs fresh data NOW.
 */
const PASSIVE_REFETCH_MIN_MS = 10_000

/**
 * Runs `onVisible` whenever the page becomes visible again or any mutation
 * broadcasts a data-changed event. Listens to:
 *   - `visibilitychange` (tab switch / OS app-switch return)
 *   - `focus` (window focus return)
 *   - `pageshow` (bfcache restore after browser back)
 *   - custom DATA_CHANGED event (in-tab mutation broadcast)
 *
 * Passive triggers are throttled to once every 10 seconds (see
 * PASSIVE_REFETCH_MIN_MS) so high-frequency mobile visibility events don't
 * fire a wave of refetches. DATA_CHANGED events always fire immediately and
 * reset the throttle window.
 *
 * Pair with a `useCallback`-wrapped fetcher so the listener is stable.
 */
export function useRefetchOnVisible(onVisible: () => void) {
  const lastCallRef = useRef(0)

  useEffect(() => {
    function shouldThrottlePassive(): boolean {
      const now = Date.now()
      if (now - lastCallRef.current < PASSIVE_REFETCH_MIN_MS) return true
      lastCallRef.current = now
      return false
    }

    function handleVisible() {
      if (document.visibilityState !== 'visible') return
      if (shouldThrottlePassive()) return
      onVisible()
    }
    function handlePassive() {
      if (shouldThrottlePassive()) return
      onVisible()
    }
    function handleDataChanged() {
      // Always refetch on a known mutation; reset the throttle so the next
      // passive trigger doesn't fire a redundant call seconds later.
      lastCallRef.current = Date.now()
      onVisible()
    }

    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', handlePassive)
    window.addEventListener('pageshow', handlePassive)
    window.addEventListener(DATA_CHANGED, handleDataChanged)
    return () => {
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('focus', handlePassive)
      window.removeEventListener('pageshow', handlePassive)
      window.removeEventListener(DATA_CHANGED, handleDataChanged)
    }
  }, [onVisible])
}
