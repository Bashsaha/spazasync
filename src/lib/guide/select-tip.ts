import type { FeatureTip, GuideSignals } from './types'
import { HOME_ROUTES, COOLDOWN_MS } from './types'
import { CATALOG } from './catalog'
import { isTriggerActive } from './triggers'

/**
 * Pure tip-selection + cadence logic (Phase 46). No DOM, no React — unit-tested
 * in isolation (tests/unit/guide.test.ts). This is the part most likely to
 * regress, so it is deliberately side-effect-free.
 */

export interface SelectInput {
  pathname: string
  /** Tip ids the user has already acknowledged ("Got it"). */
  seen: string[]
  /** User turned tips off ("Don't show tips" / Settings toggle). */
  dismissedAll: boolean
  /** Epoch ms of the last proactive nudge (0 = never). */
  lastShownAt: number
  /** Already nudged once in this app session. */
  sessionNudged: boolean
  now: number
  /** Live facts for contextual triggers; null when unavailable (offline). */
  signals: GuideSignals | null
  /** Injectable for tests; defaults to the real catalog. */
  catalog?: FeatureTip[]
}

function isHomeRoute(pathname: string): boolean {
  return (HOME_ROUTES as readonly string[]).includes(pathname)
}

/** An ambient tip (no route) shows on any home screen; a routed tip's anchor
 *  only exists on its own route. For PROACTIVE (auto) selection we only pick
 *  tips renderable on the current screen, so Stocky never yanks the user to
 *  another page uninvited. */
function onCurrentScreen(tip: FeatureTip, pathname: string): boolean {
  return tip.route === undefined || tip.route === pathname
}

/**
 * Choose the next tip, or null if none qualifies.
 *
 * Priority: an ACTIVE contextual tip (lowest order) beats curriculum tips
 * (lowest order). A contextual tip whose trigger is NOT active is skipped
 * entirely — it stays contextual.
 *
 * `restrictToScreen` is true for proactive nudges (no surprise navigation) and
 * false when the user explicitly summons Stocky (cross-screen tips allowed).
 */
export function selectTip(input: SelectInput, restrictToScreen = true): FeatureTip | null {
  const catalog = input.catalog ?? CATALOG
  const seen = new Set(input.seen)

  let pool = catalog.filter((t) => !seen.has(t.id))
  if (restrictToScreen) pool = pool.filter((t) => onCurrentScreen(t, input.pathname))

  const byOrder = (a: FeatureTip, b: FeatureTip) => a.order - b.order

  // 1) Active contextual tips win.
  const contextual = pool
    .filter((t) => isTriggerActive(t.trigger, input.signals))
    .sort(byOrder)
  if (contextual.length) return contextual[0]

  // 2) Otherwise the next curriculum tip (those without a trigger).
  const curriculum = pool.filter((t) => !t.trigger).sort(byOrder)
  return curriculum[0] ?? null
}

/**
 * May Stocky PROACTIVELY appear right now? (the "calm, earned, rare" gate)
 * — tips are enabled, on a home screen, not already nudged this session, the
 * 48h cooldown has elapsed, and there is actually an on-screen tip to give.
 */
export function canAutoShow(input: SelectInput): boolean {
  if (input.dismissedAll) return false
  if (input.sessionNudged) return false
  if (!isHomeRoute(input.pathname)) return false
  if (input.now - input.lastShownAt < COOLDOWN_MS) return false
  return selectTip(input, true) !== null
}
