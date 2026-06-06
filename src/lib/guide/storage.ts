'use client'

/**
 * Per-user, per-device persistence for Stocky (Phase 46).
 *
 * localStorage (not a DB table, not IndexedDB): synchronous so there's no flash,
 * tiny payload, and it matches the existing ChecklistReminderFab / shell-mirror
 * patterns. Worst case under Android storage eviction is a tip re-appearing —
 * harmless for a guide. State is namespaced by userId because Movestock devices
 * are shared (owner + teller on one phone), so one person's "seen" must not hide
 * tips from another. The AppChrome user-switch purge clears this alongside the
 * other caches.
 */

const STATE_KEY = 'mvs_guide_state'
const SESSION_NUDGE_KEY = 'mvs_guide_session_nudged'

export interface GuideState {
  /** Tip ids acknowledged with "Got it". */
  seen: string[]
  /** Epoch ms of the last proactive nudge (0 = never). */
  lastShownAt: number
  /** User turned tips off. Re-enabled from Settings. */
  dismissedAll: boolean
}

const EMPTY: GuideState = { seen: [], lastShownAt: 0, dismissedAll: false }

type AllState = Record<string, GuideState>

function readAll(): AllState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STATE_KEY)
    return raw ? (JSON.parse(raw) as AllState) : {}
  } catch {
    return {}
  }
}

function writeAll(all: AllState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(all))
  } catch {
    /* private mode / quota — best effort */
  }
}

export function readGuideState(userId: string): GuideState {
  const all = readAll()
  return { ...EMPTY, ...(all[userId] ?? {}) }
}

function update(userId: string, patch: Partial<GuideState>): GuideState {
  const all = readAll()
  const next: GuideState = { ...EMPTY, ...(all[userId] ?? {}), ...patch }
  all[userId] = next
  writeAll(all)
  return next
}

/** Mark a tip acknowledged (idempotent). */
export function markTipSeen(userId: string, tipId: string): GuideState {
  const current = readGuideState(userId)
  if (current.seen.includes(tipId)) return current
  return update(userId, { seen: [...current.seen, tipId] })
}

/** Record that a proactive nudge just fired (starts the 48h cooldown). */
export function recordShown(userId: string, now: number): GuideState {
  return update(userId, { lastShownAt: now })
}

/** Turn tips on/off (Settings toggle + "Don't show tips"). */
export function setTipsEnabled(userId: string, enabled: boolean): GuideState {
  return update(userId, { dismissedAll: !enabled })
}

export function readTipsEnabled(userId: string): boolean {
  return !readGuideState(userId).dismissedAll
}

// ---- session-scoped "already nudged" flag (resets each app open) ----------

export function isSessionNudged(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(SESSION_NUDGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markSessionNudged(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SESSION_NUDGE_KEY, '1')
  } catch {
    /* ignore */
  }
}
