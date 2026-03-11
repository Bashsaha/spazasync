'use client'

import { useOfflineSync } from '@/hooks/useOfflineSync'
import { OfflineBanner } from './OfflineBanner'

/**
 * Client wrapper that owns the offline sync state and renders the banner.
 * Inserted into the (app) layout so it covers all authenticated pages.
 */
export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const { isOnline, pendingCount, isSyncing } = useOfflineSync()

  return (
    <>
      <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} isSyncing={isSyncing} />
      {children}
    </>
  )
}
