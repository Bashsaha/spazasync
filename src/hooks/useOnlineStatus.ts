'use client'

import { useEffect, useState } from 'react'

/**
 * Returns true when the browser has network connectivity.
 * Tracks the native online/offline events so it updates in real time.
 */
export function useOnlineStatus(): boolean {
  // Always start as true to match server render and avoid hydration mismatch.
  // The real value is picked up in useEffect after hydration.
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const up = () => setIsOnline(true)
    const down = () => setIsOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return isOnline
}
