'use client'

import { useEffect, useRef, useState } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { countPendingSales, countFailedSales, resetFailedSales } from '@/lib/offline/db'
import { syncPendingSales, MAX_RETRIES } from '@/lib/offline/sync'

export interface OfflineSyncState {
  isOnline: boolean
  pendingCount: number
  failedCount: number
  isSyncing: boolean
  refreshCount: () => Promise<void>
  retryFailed: () => Promise<void>
}

/**
 * Manages the offline sale queue.
 *
 * - Counts pending sales and exposes them for display.
 * - Tracks sales that have exceeded max retries (failed).
 * - Automatically syncs when the device comes back online.
 * - Listens for a custom 'offlinequeue' window event so the count updates
 *   immediately after a sale is queued (without needing context/props drilling).
 * - Refreshes count whenever the page becomes visible again.
 */
export function useOfflineSync(): OfflineSyncState {
  const isOnline = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const syncingRef = useRef(false)

  async function refreshCount() {
    const [count, failed] = await Promise.all([
      countPendingSales(),
      countFailedSales(MAX_RETRIES),
    ])
    setPendingCount(count)
    setFailedCount(failed)
  }

  async function retryFailed() {
    await resetFailedSales(MAX_RETRIES)
    await refreshCount()
  }

  // Initial count
  useEffect(() => {
    refreshCount()
  }, [])

  // Refresh when page regains focus (e.g. user switches back from another app)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') refreshCount()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Refresh when sale/page.tsx queues an offline sale
  useEffect(() => {
    function onQueue() { refreshCount() }
    window.addEventListener('offlinequeue', onQueue)
    return () => window.removeEventListener('offlinequeue', onQueue)
  }, [])

  // Auto-sync whenever we come back online and have pending sales
  useEffect(() => {
    if (!isOnline || pendingCount === 0 || syncingRef.current) return

    syncingRef.current = true
    setIsSyncing(true)

    syncPendingSales()
      .then(() => refreshCount())
      .finally(() => {
        syncingRef.current = false
        setIsSyncing(false)
      })
  }, [isOnline, pendingCount])

  return { isOnline, pendingCount, failedCount, isSyncing, refreshCount, retryFailed }
}
