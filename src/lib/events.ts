/**
 * Tiny in-tab event bus. Mutations (save/delete) broadcast on the window so
 * any currently-mounted list page can refetch without relying on browser
 * visibility events (which don't fire during intra-SPA navigation).
 */
export const DATA_CHANGED = 'movestock:data-changed'

export function emitDataChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DATA_CHANGED))
}
