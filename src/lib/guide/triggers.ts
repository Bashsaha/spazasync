import type { GuideSignals, TriggerId } from './types'

/**
 * Pure, rule-based "right moment" triggers (Phase 46). NO AI — each is a plain
 * predicate over {@link GuideSignals} (facts pulled once from /api/summary/daily).
 *
 * A contextual tip only surfaces while its trigger is active, so Stocky teaches
 * a feature exactly when the owner has a reason to care about it.
 */
export const TRIGGER_PREDICATES: Record<TriggerId, (s: GuideSignals) => boolean> = {
  // Something is at/below the shop's low-stock threshold → teach the stock screen.
  low_stock: (s) => s.lowStockCount > 0,
  // A batch is expired or expiring soon → teach the expiry monitor.
  expiring_soon: (s) => s.expiringCount > 0,
  // Profit tracking is on but some products have no cost price → teach products.
  missing_cost: (s) => s.productsMissingCost > 0,
  // Late afternoon/evening with no sale recorded yet → nudge the sale flow.
  no_sale_today: (s) => s.salesTodayCount === 0 && s.hourOfDay >= 16,
}

/** True when a tip's trigger condition currently holds. A tip with no trigger,
 *  or when signals are unavailable (offline / fetch failed), is never "active"
 *  — it falls back to plain curriculum ordering. */
export function isTriggerActive(
  trigger: TriggerId | undefined,
  signals: GuideSignals | null,
): boolean {
  if (!trigger || !signals) return false
  return TRIGGER_PREDICATES[trigger](signals)
}
