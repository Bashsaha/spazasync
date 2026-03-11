'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker on first render.
 * Must be a Client Component — rendered inside RootLayout.
 * Returns null (no visible output).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err)
      })
    }
  }, [])

  return null
}
