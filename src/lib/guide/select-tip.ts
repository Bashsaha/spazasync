import type { FeatureTip, GuideSignals } from './types'
import { CATALOG } from './catalog'
import { isTriggerActive } from './triggers'

/**
 * Pure tip-listing logic (Phase 47). No DOM, no React — unit-tested in isolation
 * (tests/unit/guide.test.ts). This is the part most likely to regress, so it is
 * deliberately side-effect-free.
 *
 * The model is on-demand: the owner taps Stocky and we show the tips for the
 * page they're on. There is no proactive cadence to gate anymore — discovery is
 * handled by the always-visible button + a one-time welcome (in the React layer).
 */

export interface SelectInput {
  pathname: string
  /** Tip ids the user has already acknowledged ("Got it"). */
  seen: string[]
  /** Live facts for contextual triggers; null when unavailable (offline). */
  signals: GuideSignals | null
  /** Injectable for tests; defaults to the real catalog. */
  catalog?: FeatureTip[]
}

export interface PageTip {
  tip: FeatureTip
  /** A contextual trigger is firing → sort first + light the dot. */
  active: boolean
  /** Already acknowledged → grey it + sort last (kept so help stays re-findable). */
  seen: boolean
}

/** An ambient tip (no route) belongs to every guide screen; a routed tip only
 *  to its own screen. */
function onRoute(tip: FeatureTip, pathname: string): boolean {
  return tip.route === undefined || tip.route === pathname
}

/**
 * The tips to list in the help sheet for the current page, already ordered:
 * active-contextual first, then unseen, then seen; ties broken by curriculum
 * order. A contextual tip whose trigger is NOT active is omitted entirely — it
 * stays contextual. Every guide route has at least one (non-contextual) route
 * tip, so the list is never empty.
 */
export function listPageTips(input: SelectInput): PageTip[] {
  const catalog = input.catalog ?? CATALOG
  const seen = new Set(input.seen)

  return catalog
    .filter((t) => onRoute(t, input.pathname))
    .filter((t) => !t.trigger || isTriggerActive(t.trigger, input.signals))
    .map((t) => ({ tip: t, active: Boolean(t.trigger), seen: seen.has(t.id) }))
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      if (a.seen !== b.seen) return a.seen ? 1 : -1
      return a.tip.order - b.tip.order
    })
}

/** Whether any contextual tip is currently active on this page → show the amber
 *  dot on the resting button. */
export function hasActiveTip(input: SelectInput): boolean {
  return listPageTips(input).some((p) => p.active)
}
