'use client'

/**
 * Per-user, per-device persistence for Stocky (Phase 46 → 47).
 *
 * localStorage (not a DB table, not IndexedDB): synchronous so there's no flash,
 * tiny payload, and it matches the existing ChecklistReminderFab / shell-mirror
 * patterns. Worst case under Android storage eviction is the welcome re-showing
 * once — harmless for a guide. State is namespaced by userId because Movestock
 * devices are shared (owner + teller on one phone), so one person's "seen" must
 * not hide tips from another. The AppChrome user-switch purge clears this
 * alongside the other caches.
 */

const STATE_KEY = 'mvs_guide_state'

export interface GuideState {
  /** Tip ids acknowledged with "Got it". */
  seen: string[]
  /** User turned the helper off. Re-enabled from Settings. */
  dismissedAll: boolean
  /** Epoch ms the one-time welcome was acknowledged (0 = never shown). */
  introShownAt: number
  /** How many times the "Tap me for help" caption has shown (capped). */
  helperHintCount: number
  /** Whether the help sheet has ever been opened (gates the first-open hint). */
  helperSheetOpened: boolean
}

const EMPTY: GuideState = {
  seen: [],
  dismissedAll: false,
  introShownAt: 0,
  helperHintCount: 0,
  helperSheetOpened: false,
}

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

/** Record that the one-time welcome was acknowledged (or self-discovered). */
export function markIntroSeen(userId: string, now: number): GuideState {
  return update(userId, { introShownAt: now })
}

/** Allow the welcome to show again (used when re-enabling tips in Settings). */
export function resetIntro(userId: string): GuideState {
  return update(userId, { introShownAt: 0, helperHintCount: 0 })
}

/** Count one showing of the "Tap me for help" caption. */
export function bumpHelperHint(userId: string): GuideState {
  const current = readGuideState(userId)
  return update(userId, { helperHintCount: current.helperHintCount + 1 })
}

/** Remember the help sheet has been opened (so the first-open hint shows once). */
export function markSheetOpened(userId: string): GuideState {
  return update(userId, { helperSheetOpened: true })
}

/** Turn the helper on/off (Settings toggle + "Hide helper"). */
export function setTipsEnabled(userId: string, enabled: boolean): GuideState {
  return update(userId, { dismissedAll: !enabled })
}

export function readTipsEnabled(userId: string): boolean {
  return !readGuideState(userId).dismissedAll
}

const UNHIDE_FLAG = 'mvs_guide_unhide_v1'

/**
 * One-time migration: the top-bar "Hide helper" button was removed, which left
 * anyone who had hidden Stocky with no way to bring it back (the only remaining
 * off-switch is Settings → Helper tips, which a hidden user can't discover).
 * Clear the dismissedAll flag for every stored user, once per device. This also
 * re-enables tips for the rare user who turned them off in Settings — acceptable,
 * since they can simply turn them off again.
 */
export function unhideAllOnce(): void {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(UNHIDE_FLAG)) return
    const all = readAll()
    for (const id of Object.keys(all)) {
      if (all[id]?.dismissedAll) all[id] = { ...all[id], dismissedAll: false }
    }
    writeAll(all)
    window.localStorage.setItem(UNHIDE_FLAG, '1')
  } catch {
    /* private mode / quota — best effort */
  }
}
