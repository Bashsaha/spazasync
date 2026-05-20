'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible'
import { consumeDataDirty } from '@/lib/events'

/**
 * Keeps the dashboard's server-rendered numbers (today's sales, low stock,
 * latest sales) fresh without a full page reload. `router.refresh()` re-streams
 * the server components in place — far cheaper than a hard navigation and the
 * existing UI stays on screen while it updates, so we keep the speed (BUG-042).
 *
 * Two triggers:
 *   1. On mount, if a mutation happened since the last render (e.g. a sale was
 *      just completed on /sale before navigating here) — pull fresh data once.
 *   2. While mounted, on any in-tab mutation or when the tab regains focus.
 *
 * Plain dashboard visits with no preceding mutation do NOT refresh, so the
 * cached render stays instant.
 */
export function DashboardAutoRefresh() {
  const router = useRouter()

  useEffect(() => {
    if (consumeDataDirty()) router.refresh()
  }, [router])

  useRefetchOnVisible(() => router.refresh())

  return null
}
