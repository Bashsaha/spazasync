import type { SubscriptionStatus } from '@/types'

/**
 * Shared status badge color classes for subscription status.
 * Used in admin shop list and shop detail pages.
 */
export const statusBadgeColors: Record<SubscriptionStatus, string> = {
  trialing: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
  expired: 'bg-red-100 text-red-700',
  manual_override: 'bg-amber-100 text-amber-700',
}
