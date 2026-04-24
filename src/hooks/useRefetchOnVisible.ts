import { useEffect } from 'react'
import { DATA_CHANGED } from '@/lib/events'

/**
 * Runs `onVisible` whenever the page becomes visible again or any mutation
 * broadcasts a data-changed event. Listens to:
 *   - `visibilitychange` (tab switch / OS app-switch return)
 *   - `focus` (window focus return)
 *   - `pageshow` (bfcache restore after browser back)
 *   - custom DATA_CHANGED event (in-tab mutation broadcast)
 * Pair with a `useCallback`-wrapped fetcher so the listener is stable.
 */
export function useRefetchOnVisible(onVisible: () => void) {
  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === 'visible') onVisible()
    }
    function handleEvent() {
      onVisible()
    }
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', handleEvent)
    window.addEventListener('pageshow', handleEvent)
    window.addEventListener(DATA_CHANGED, handleEvent)
    return () => {
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('focus', handleEvent)
      window.removeEventListener('pageshow', handleEvent)
      window.removeEventListener(DATA_CHANGED, handleEvent)
    }
  }, [onVisible])
}
