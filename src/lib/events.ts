/**
 * Tiny in-tab event bus. Mutations (save/delete) broadcast on the window so
 * any currently-mounted list page can refetch without relying on browser
 * visibility events (which don't fire during intra-SPA navigation).
 */
export const DATA_CHANGED = 'movestock:data-changed'

/**
 * sessionStorage marker that survives navigation. A mutation often fires
 * `emitDataChanged()` just before navigating away (e.g. completing a sale on
 * /sale then routing to /sale/complete), so the dashboard isn't mounted yet to
 * hear the live event. The dashboard reads + clears this flag on mount and
 * pulls fresh server data only when something actually changed — keeping the
 * page fast on plain visits (BUG-042).
 */
const DATA_DIRTY_KEY = 'movestock:data-dirty'

export function emitDataChanged() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(DATA_DIRTY_KEY, '1')
  } catch {
    // sessionStorage unavailable (private mode quirks) — the live event below
    // still covers the already-mounted case.
  }
  window.dispatchEvent(new Event(DATA_CHANGED))
}

/** Returns true (and clears the flag) if a mutation happened since last checked. */
export function consumeDataDirty(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (sessionStorage.getItem(DATA_DIRTY_KEY)) {
      sessionStorage.removeItem(DATA_DIRTY_KEY)
      return true
    }
  } catch {
    // ignore
  }
  return false
}
