'use client'

import { useEffect, useState } from 'react'

/**
 * Registers the service worker and shows a reload banner when a new version is available.
 * Must be a Client Component — rendered inside RootLayout.
 */
export function ServiceWorkerRegistrar() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Detect new SW installing while tab is open
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') setUpdateAvailable(true)
        })
      })
    }).catch((err) => {
      console.warn('Service worker registration failed:', err)
    })

    // Also listen for SW_UPDATED message (covers cross-tab updates)
    function onMessage(event: MessageEvent) {
      if (event.data?.type === 'SW_UPDATED') setUpdateAvailable(true)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  if (!updateAvailable) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-brand text-white text-center text-sm py-3 px-4 flex items-center justify-center gap-3 safe-area-pb">
      <span>A new version is available</span>
      <button
        onClick={() => window.location.reload()}
        className="bg-white text-brand font-semibold text-xs px-3 py-1 rounded-lg active:bg-brand-light"
      >
        Reload
      </button>
    </div>
  )
}
