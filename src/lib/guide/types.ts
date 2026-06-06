// ============================================================
// Stocky — the in-app feature guide (Phase 46)
// ============================================================
//
// "Stocky" is a small, friendly robot that occasionally appears on the home
// screens and teaches ONE app feature at a time, pointing at the thing to tap.
//
// HARD CONSTRAINT: this is plain software, NOT an AI feature. At build time the
// catalog below is hand-authored from a walk of the whole app; at RUNTIME the
// guide only reads this static data + a couple of already-existing read
// endpoints. No LLM, no inference, no per-tip network call.
//
// This file holds the shared types + tuning constants. The pure logic lives in
// select-tip.ts / triggers.ts (unit-tested, no DOM); the catalog data in
// catalog.ts; the React UI in src/components/guide/.

/** Stocky only ever shows to owners/admins — never tellers (they live on /sale
 *  mid-transaction; a tip there is pure obstruction). */
export type GuideRole = 'owner' | 'admin'

/** Rule-based "right moment" triggers. Each maps to a pure predicate in
 *  triggers.ts evaluated against {@link GuideSignals}. A tip carrying a trigger
 *  is CONTEXTUAL: it only surfaces while its condition is true (and then it
 *  jumps the queue), otherwise it stays hidden. */
export type TriggerId =
  | 'low_stock'      // something is running low → teach the stock screen
  | 'expiring_soon'  // batches expiring → teach expiry monitor
  | 'missing_cost'   // profit tracking on but costs missing → teach products
  | 'no_sale_today'  // late in the day with zero sales → nudge the sale flow

/** Lightweight facts the guide reads (once) from /api/summary/daily to decide
 *  whether any contextual trigger is active. All optional sources default to 0
 *  so a missing/failed fetch simply means "no trigger fires" (curriculum order
 *  still works offline). */
export interface GuideSignals {
  salesTodayCount: number
  lowStockCount: number
  expiringCount: number
  productsMissingCost: number
  /** Hour of day in SAST (0–23) — for the evening "no sale yet" nudge. */
  hourOfDay: number
}

export interface FeatureTip {
  /** Stable unique key — also the per-user "seen" tracking key. Never reuse. */
  id: string
  /** The `data-tour="<token>"` attribute of the element to highlight. */
  anchor: string
  /**
   * Route the anchor lives on. OMIT for "ambient" anchors that exist on every
   * home screen (the bottom-nav tabs + the New-Sale FAB) — those tips show
   * in-place wherever the user already is. When set, the tip is specific to one
   * screen and Stocky navigates there before highlighting.
   */
  route?: string
  /** i18n keys in the `guide` namespace. */
  titleKey: string
  bodyKey: string
  /** Curriculum order — lower shows first among non-contextual tips. */
  order: number
  /** Optional contextual trigger. When present, the tip ONLY shows while the
   *  trigger is active (and then it takes priority over curriculum tips). */
  trigger?: TriggerId
}

/** The only screens Stocky is allowed to appear on — calm "decision/browse"
 *  hubs, never task screens (/sale, forms, scanning). */
export const HOME_ROUTES = ['/dashboard', '/sales', '/inventory', '/manage'] as const

/** Cadence: at most one proactive tip every 48 hours (plus the once-per-session
 *  guard in storage). Tunable from one place. */
export const COOLDOWN_MS = 48 * 60 * 60 * 1000

/** Idle settle before Stocky may appear — the screen must be still this long so
 *  we never interrupt someone who just arrived and is actively reading/tapping. */
export const IDLE_SETTLE_MS = 4000

/** If a proactive nudge is ignored this long, Stocky quietly leaves. */
export const AUTO_DISMISS_MS = 14000
