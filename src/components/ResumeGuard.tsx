'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { emitResumeReady } from '@/lib/events'

/**
 * Owns the "app returned to the foreground" sequence so the rest of the app
 * never refreshes data into a half-awake radio or an expired token.
 *
 * The resume-from-background bug had two compounding causes on mid-range
 * Android:
 *   1. The OS suspends the network radio while backgrounded; a refresh fired
 *      the instant the app becomes visible hits a dead radio (hang / throw).
 *   2. The Supabase access token can expire while backgrounded, and the client
 *      can desync after a long suspension (documented: supabase/supabase#36046)
 *      — `getSession()` returns null on a valid session and calls hang.
 *
 * On every resume signal (visibilitychange→visible / focus / pageshow / online)
 * this guard, in order:
 *   (a) skips if the browser reports offline (no point);
 *   (b) confirms reachability with a HEAD-ish probe to /manifest.json (an
 *       unauthenticated static asset) — the same trick useOnlineStatus uses,
 *       because navigator.onLine lies on Android;
 *   (c) refreshes the Supabase session IF the token is within 2 min of expiry
 *       (or already expired), racing an 8s timeout so a sleeping radio can't
 *       hang us — this writes a fresh token to the cookie so the next RSC
 *       navigation's server render sees a valid session;
 *   (d) only THEN broadcasts RESUME_READY, which is what passive data-refresh
 *       consumers wait for (see useRefetchOnVisible).
 *
 * Mounted once in the (app) layout. Returns null (no UI).
 */

const REFRESH_SKEW_MS = 120_000 // refresh when the token expires within 2 min
const PROBE_TIMEOUT_MS = 4000
const REFRESH_TIMEOUT_MS = 8000

export function ResumeGuard() {
  useEffect(() => {
    const supabase = createClient()
    let busy = false

    async function probeOnline(): Promise<boolean> {
      // Trust an explicit offline signal; otherwise confirm with a real fetch
      // (navigator.onLine reports false while the radio merely sleeps).
      if (navigator.onLine === false) return false
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS)
        const res = await fetch(`/manifest.json?rg=${Date.now()}`, {
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

    async function maybeRefreshSession(): Promise<void> {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session) return
        const expMs = (session.expires_at ?? 0) * 1000
        if (expMs - Date.now() >= REFRESH_SKEW_MS) return // still fresh — skip
        // Race a timeout so a sleeping radio can't hang the resume sequence.
        await Promise.race([
          supabase.auth.refreshSession(),
          new Promise((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
        ])
      } catch {
        // Offline / transient — leave the existing token; next resume retries.
      }
    }

    async function onResume() {
      if (document.visibilityState !== 'visible') return
      if (busy) return
      busy = true
      try {
        const online = await probeOnline()
        if (!online) return // stay quiet; the `online` listener will re-run us
        await maybeRefreshSession()
        emitResumeReady()
      } finally {
        busy = false
      }
    }

    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('focus', onResume)
    window.addEventListener('pageshow', onResume)
    window.addEventListener('online', onResume)
    // Run once on mount: a cold resume can land already-visible without firing
    // any of the events above.
    onResume()

    return () => {
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('pageshow', onResume)
      window.removeEventListener('online', onResume)
    }
  }, [])

  return null
}
