'use client'

import { useTranslation } from '@/components/LanguageProvider'

interface OfflineBannerProps {
  isOnline: boolean
  pendingCount: number
  failedCount: number
  isSyncing: boolean
  onRetryFailed?: () => void
}

/**
 * Thin top banner that surfaces connectivity and sync status.
 * Renders nothing when online with no pending/failed sales.
 */
export function OfflineBanner({ isOnline, pendingCount, failedCount, isSyncing, onRetryFailed }: OfflineBannerProps) {
  const { t, tPlural } = useTranslation()

  if (isSyncing) {
    return (
      <div className="bg-brand text-white text-xs text-center py-2 px-4">
        {tPlural('offline_banner_syncing', pendingCount, { count: pendingCount })}
      </div>
    )
  }

  if (failedCount > 0 && isOnline) {
    return (
      <div
        className="bg-red-500 text-white text-xs text-center py-2 px-4 cursor-pointer active:bg-red-600"
        onClick={onRetryFailed}
      >
        {tPlural('offline_banner_failed', failedCount, { count: failedCount })}
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="bg-amber-500 text-white text-xs text-center py-2 px-4">
        {pendingCount > 0
          ? tPlural('offline_banner_offline_pending', pendingCount, { count: pendingCount })
          : t('offline_banner_offline')}
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="bg-brand text-white text-xs text-center py-2 px-4">
        {tPlural('offline_banner_pending', pendingCount, { count: pendingCount })}
      </div>
    )
  }

  return null
}
