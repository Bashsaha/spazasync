// ============================================================
// Stocky — the in-app feature guide (Phase 46 → 47)
// ============================================================
//
// "Stocky" is a small, friendly robot that lives in the top app bar. The owner
// can TAP it at any time to get help about the screen they're on, and a calm
// amber dot appears when something actually needs attention (low stock,
// expiring, etc.). A one-time welcome (Phase 47) introduces it by spotlighting
// the button itself, so owners discover it instead of never noticing it.
//
// HARD CONSTRAINT: this is plain software, NOT an AI feature. At build time the
// catalog is hand-authored from a walk of the whole app; at RUNTIME the guide
// only reads this static data + one already-existing read endpoint. No LLM, no
// inference, no per-tip network call.
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
 *  floats to the top of the sheet + lights the dot), otherwise it stays hidden. */
export type TriggerId =
  | 'low_stock'      // something is running low → teach the stock screen
  | 'expiring_soon'  // batches expiring → teach expiry monitor
  | 'missing_cost'   // profit tracking on but costs missing → teach products
  | 'no_sale_today'  // late in the day with zero sales → nudge the sale flow

/** Lightweight facts the guide reads (once) from /api/summary/daily to decide
 *  whether any contextual trigger is active. All optional sources default to 0
 *  so a missing/failed fetch simply means "no trigger fires" (the per-page route
 *  tip still works offline). */
export interface GuideSignals {
  salesTodayCount: number
  lowStockCount: number
  expiringCount: number
  productsMissingCost: number
  /** Hour of day in SAST (0–23) — for the evening "no sale yet" nudge. */
  hourOfDay: number
}

/**
 * Sheet section a tip belongs to (Phase 49). The help sheet groups tips under
 * labelled headers so a page with 6–10 tips stays scannable instead of being one
 * long wall. `attention` is special: any *active contextual* tip is force-bucketed
 * there (pinned to the top) regardless of its authored group. Untriggered tips
 * use their authored `group`, defaulting to `basics`.
 */
export type GuideGroup = 'attention' | 'basics' | 'reports' | 'setup'

/** Fixed render order of the sheet's sections. */
export const GUIDE_GROUP_ORDER: GuideGroup[] = ['attention', 'basics', 'reports', 'setup']

export interface FeatureTip {
  /** Stable unique key — also the per-user "seen" tracking key. Never reuse. */
  id: string
  /** The `data-tour="<token>"` attribute of the element to highlight. */
  anchor: string
  /**
   * Route the tip belongs to. OMIT for "ambient" tips (the contextual ones)
   * whose anchor lives on every guide screen (the bottom-nav tabs + the New-Sale
   * FAB) — those surface wherever the owner already is. When set, the tip only
   * appears in that screen's help sheet. For dynamic screens use the canonical
   * key (e.g. `/stock/[id]`), which {@link matchGuideRoute} resolves a live path to.
   */
  route?: GuideRouteKey
  /** i18n keys in the `guide` namespace. */
  titleKey: string
  bodyKey: string
  /** Curriculum order — lower shows first within a section. */
  order: number
  /** Sheet section. Defaults to `basics` when omitted. Ignored for an active
   *  contextual tip (those are pinned into `attention`). */
  group?: GuideGroup
  /** Optional contextual trigger. When present, the tip ONLY shows while the
   *  trigger is active (and then it sorts first + lights the dot). */
  trigger?: TriggerId
}

/** Screens where the Stocky helper button appears + has authored page tips. The
 *  button is hidden everywhere else (forms, /sale, deep compliance pages) so it
 *  never shows up with nothing relevant to say. Includes a few rich detail
 *  screens (Phase 49) whose paths are matched via {@link matchGuideRoute}. The
 *  `[id]` entry is a canonical key, NOT a live path — live paths look like
 *  `/stock/abc123`. */
export const GUIDE_ROUTES = [
  '/dashboard',
  '/sales',
  '/inventory',
  '/manage',
  '/stock',
  '/products',
  '/sales/statistics',
  '/sales/history',
  '/stock/[id]',
] as const

export type GuideRouteKey = (typeof GUIDE_ROUTES)[number]

/**
 * Resolve a LIVE pathname to its canonical guide-route key (Phase 49), or null
 * when the path is not a guide screen. Exact paths map to themselves; the dynamic
 * stock-detail path `/stock/<id>` maps to the `/stock/[id]` key. Order matters:
 * exact `/stock` is checked first so the bare stock list never matches the
 * dynamic rule. Catalog tips carry these keys in their `route`.
 */
export function matchGuideRoute(pathname: string): GuideRouteKey | null {
  if ((GUIDE_ROUTES as readonly string[]).includes(pathname)) {
    return pathname as GuideRouteKey
  }
  // Stock detail: exactly one segment after /stock (not /stock itself, handled above).
  if (/^\/stock\/[^/]+$/.test(pathname)) return '/stock/[id]'
  return null
}

/** The one screen the first-run welcome fires on (the calm overview hub). */
export const INTRO_ROUTE = '/dashboard'

/** Idle settle before the first-run welcome may appear — the screen must be
 *  still this long so we never interrupt someone who just arrived. */
export const IDLE_SETTLE_MS = 4000

/** The "Tap me for help" caption shows on at most this many home-screen visits
 *  after the welcome, then never again. */
export const HELPER_HINT_MAX = 3
