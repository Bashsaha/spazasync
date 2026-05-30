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
 * Short delay before a passive (visibility/focus/pageshow) refetch fires, so it
 * doesn't race a just-woken radio the instant the user switches back to the
 * app. On Android, firing synchronously on resume means the fetch (or
 * router.refresh()'s RSC request) hits a still-suspended radio and can throw
 * into the (app) error boundary. A small settle window lets the connection come
 * up first. DATA_CHANGED (a known mutation) still fires immediately.
 */
const PASSIVE_SETTLE_MS = 600

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
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function shouldThrottlePassive(): boolean {
      const now = Date.now()
      if (now - lastCallRef.current < PASSIVE_REFETCH_MIN_MS) return true
      lastCallRef.current = now
      return false
    }

    function runPassive() {
      // Skip passive refreshes while offline. They only fail, and a
      // router.refresh() into a dead/mid-wake radio is what surfaces the
      // "unexpected error" boundary on resume. Realtime + DATA_CHANGED still
      // deliver fresh data once the connection is back, and the next real
      // navigation re-renders server state anyway.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      if (shouldThrottlePassive()) return
      // Settle briefly so the refresh doesn't race the waking radio.
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
      settleTimerRef.current = setTimeout(onVisible, PASSIVE_SETTLE_MS)
    }

    function handleVisible() {
      if (document.visibilityState !== 'visible') return
      runPassive()
    }
    function handlePassive() {
      runPassive()
    }
    function handleDataChanged() {
      // Always refetch immediately on a known mutation; cancel any pending
      // settle timer and reset the throttle so a passive trigger doesn't fire a
      // redundant call seconds later.
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
      lastCallRef.current = Date.now()
      onVisible()
    }

    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', handlePassive)
    window.addEventListener('pageshow', handlePassive)
    window.addEventListener(DATA_CHANGED, handleDataChanged)
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('focus', handlePassive)
      window.removeEventListener('pageshow', handlePassive)
      window.removeEventListener(DATA_CHANGED, handleDataChanged)
    }
  }, [onVisible])
}
