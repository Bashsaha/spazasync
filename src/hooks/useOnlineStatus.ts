'use client'

import { useEffect, useState } from 'react'

/**
 * Returns true when the browser actually has network connectivity.
 *
 * navigator.onLine is famously unreliable on Android Chrome — it flips to
 * `false` during cellular handoffs, radio sleep, and short DNS hiccups even
 * when the device is fine. Trusting it directly produces a misleading
 * "You're offline" banner while the user is browsing normally.
 *
 * Strategy:
 *  - `online` event is trusted immediately (false-positive there is rare).
 *  - `offline` event is debounced 1.5s, then confirmed by a HEAD probe to
 *    /manifest.json (an unauthenticated static asset that always serves).
 *    Only declare offline if the probe ALSO fails.
 *  - Visibility change probes once on tab focus so a user returning from
 *    backgrounding gets the correct state even if Android suppressed the
 *    online/offline events while the tab was hidden.
 */
export function useOnlineStatus(): boolean {
  // Always start as true to match server render and avoid hydration mismatch.
  // The real value is picked up in useEffect after hydration.
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    let cancelled = false
    let pendingCheck: ReturnType<typeof setTimeout> | null = null

    setIsOnline(navigator.onLine)

    async function probe(): Promise<boolean> {
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 4000)
        const res = await fetch(`/manifest.json?probe=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          signal: ctrl.signal,
        })
        clearTimeout(t)
        return res.ok
      } catch {
        return false
      }
    }

    function clearPending() {
      if (pendingCheck) {
        clearTimeout(pendingCheck)
        pendingCheck = null
      }
    }

    function onOnline() {
      clearPending()
      if (!cancelled) setIsOnline(true)
    }

    function onOffline() {
      clearPending()
      pendingCheck = setTimeout(async () => {
        const reachable = await probe()
        if (cancelled) return
        // Only declare offline if BOTH the probe failed AND navigator still
        // says offline. Either signal saying we're online wins.
        setIsOnline(reachable || navigator.onLine)
      }, 1500)
    }

    async function onVisible() {
      if (document.visibilityState !== 'visible') return
      // After backgrounding, Android often doesn't fire online/offline. Probe
      // once on resume so the banner reflects reality.
      const reachable = await probe()
      if (cancelled) return
      setIsOnline(reachable || navigator.onLine)
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearPending()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return isOnline
}
