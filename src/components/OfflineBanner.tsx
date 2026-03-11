interface OfflineBannerProps {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
}

/**
 * Thin top banner that surfaces connectivity and sync status.
 * Renders nothing when online with no pending sales.
 */
export function OfflineBanner({ isOnline, pendingCount, isSyncing }: OfflineBannerProps) {
  if (isSyncing) {
    return (
      <div className="bg-blue-500 text-white text-xs text-center py-2 px-4">
        Syncing {pendingCount} saved sale{pendingCount !== 1 ? 's' : ''}…
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="bg-amber-500 text-white text-xs text-center py-2 px-4">
        {pendingCount > 0
          ? `Offline — ${pendingCount} sale${pendingCount !== 1 ? 's' : ''} saved, will sync automatically`
          : "You're offline — sales will sync automatically when you reconnect"}
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="bg-blue-500 text-white text-xs text-center py-2 px-4">
        {pendingCount} sale{pendingCount !== 1 ? 's' : ''} waiting to sync…
      </div>
    )
  }

  return null
}
