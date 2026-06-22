import type { SubscriptionStatus } from '@/types'

/**
 * Shared status badge color classes for subscription status.
 * Used in admin shop list and shop detail pages.
 */
export const statusBadgeColors: Record<SubscriptionStatus, string> = {
  trialing: 'bg-brand-light text-brand-dark',
  active: 'bg-brand-light text-brand-dark',
  cancelled: 'bg-gray-100 text-gray-600',
  expired: 'bg-red-100 text-red-700',
  manual_override: 'bg-amber-100 text-amber-700',
  // 4-day grace window (Phase 54) — amber "attention, time-limited, not yet dead".
  processing_cancellation: 'bg-amber-100 text-amber-700',
}

/** Human label for a subscription status (operator-facing, English). */
export const statusLabels: Record<SubscriptionStatus, string> = {
  trialing: 'Trialing',
  active: 'Active',
  cancelled: 'Cancelled',
  expired: 'Expired',
  manual_override: 'Manual override',
  processing_cancellation: 'Processing cancellation',
}
