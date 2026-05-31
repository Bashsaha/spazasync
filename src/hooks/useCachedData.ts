'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { DATA_CHANGED, RESUME_READY } from '@/lib/events'

/**
 * Cache-first data loading — the Phase 44b "instant open" engine.
 *
 * Every list/detail screen used to mount, show a loading spinner, then fetch
 * from the server before showing anything — so opening a tab (especially after
 * the app was backgrounded) meant staring at a spinner while the radio woke.
 *
 * This hook flips that to the pattern Instagram/Twitter Lite use:
 *   1. PAINT INSTANTLY from the last snapshot saved on the device (localStorage)
 *      — on a repeat visit the real data is on screen with zero network wait.
 *   2. REVALIDATE in the background: fetch fresh, update the UI, re-save the
 *      snapshot. The user is already looking at usable data while this runs.
 *   3. RE-FETCH on resume (RESUME_READY — fired by ResumeGuard once the
 *      connection is confirmed up + the session refreshed) and on any in-tab
 *      mutation (DATA_CHANGED).
 *
 * localStorage (not IndexedDB) is deliberate: its read is synchronous, so the
 * cached value is available the instant the component mounts. Snapshots are
 * small JSON API responses — well within the ~5MB budget. (Large binary-ish
 * caches like the full product list still use IndexedDB via lib/offline/db.ts.)
 *
 * `error` is only ever surfaced when there's NOTHING cached to show — a failed
 * background refresh over good cached data must never replace real numbers with
 * an error banner (that's the whole point of cache-first on a flaky network).
 *
 * Pass a STABLE `fetcher` (useCallback) or rely on the internal ref; `key` must
 * be unique per logical dataset (include query params that change the result).
 */

const PREFIX = 'mvs_cache:'

/** Synchronous read of a cached snapshot (client only). */
export function readClientCache<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

function writeClientCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Quota / private mode — caching is best-effort; the fetch still works.
  }
}

export interface CachedDataResult<T> {
  /** The data to render: cached snapshot first, then fresh. `undefined` only
   *  before the very first successful load on a device with no snapshot. */
  data: T | undefined
  /** True only when there is NOTHING to show yet (no cache + first fetch
   *  in-flight). On repeat visits this is false from the first frame. */
  loading: boolean
  /** True only when the fetch failed AND there is no cached data to fall back
   *  on. With a cached snapshot present, a failed refresh keeps showing it. */
  error: boolean
  /** Manually trigger a background revalidate. */
  refresh: () => void
}

export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
): CachedDataResult<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Keep the latest fetcher without making `refresh` change identity each render.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  // Mirror current data so the catch handler can decide whether to surface an
  // error without depending on a stale `data` closure.
  const dataRef = useRef<T | undefined>(undefined)

  const applyData = useCallback((next: T) => {
    dataRef.current = next
    setData(next)
    setError(false)
    setLoading(false)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetcherRef.current()
      applyData(fresh)
      writeClientCache(key, fresh)
    } catch {
      setLoading(false)
      // Only show an error when we have nothing cached to display.
      if (dataRef.current === undefined) setError(true)
    }
  }, [key, applyData])

  // 1) Instant paint from the snapshot (client-only effect → no SSR hydration
  //    mismatch; the synchronous localStorage read lands in the same tick as
  //    mount, so on repeat visits the spinner is skipped entirely).
  useEffect(() => {
    const cached = readClientCache<T>(key)
    if (cached !== undefined) {
      dataRef.current = cached
      setData(cached)
      setLoading(false)
    } else {
      // New key (e.g. changed date range) — reset to loading until fetch lands.
      dataRef.current = undefined
      setData(undefined)
      setLoading(true)
    }
  }, [key])

  // 2) Always revalidate on mount / when the key changes.
  useEffect(() => {
    refresh()
  }, [refresh])

  // 3) Revalidate on resume (post session-refresh) + on in-tab mutations.
  useEffect(() => {
    function onResume() {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      refresh()
    }
    window.addEventListener(RESUME_READY, onResume)
    window.addEventListener(DATA_CHANGED, refresh)
    return () => {
      window.removeEventListener(RESUME_READY, onResume)
      window.removeEventListener(DATA_CHANGED, refresh)
    }
  }, [refresh])

  return { data, loading, error, refresh }
}
