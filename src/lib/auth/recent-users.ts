/**
 * Recent users — remembered on this device only, NEVER passwords.
 *
 * Stored in localStorage so the next person to sign in on the same phone can
 * tap their identity instead of retyping shop code + name (or email). The
 * password field is always required — we only persist the non-secret part.
 *
 * Sorted most-recent first; capped at MAX_RECENT entries.
 */

export type RecentUser =
  | { kind: 'owner'; email: string; last_used_at: number }
  | { kind: 'teller'; shop_code: string; display_name: string; last_used_at: number }
  | { kind: 'admin'; email: string; last_used_at: number }

/** Input shape for `recordRecentUser` — same union without the timestamp. */
export type RecentUserInput =
  | { kind: 'owner'; email: string }
  | { kind: 'teller'; shop_code: string; display_name: string }
  | { kind: 'admin'; email: string }

const STORAGE_KEY = 'mvs_recent_users_v1'
const MAX_RECENT = 3

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function read(): RecentUser[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Light validation — drop anything that doesn't look like a RecentUser.
    return parsed.filter(
      (u): u is RecentUser =>
        u &&
        typeof u === 'object' &&
        typeof u.last_used_at === 'number' &&
        ((u.kind === 'owner' && typeof u.email === 'string') ||
          (u.kind === 'admin' && typeof u.email === 'string') ||
          (u.kind === 'teller' &&
            typeof u.shop_code === 'string' &&
            typeof u.display_name === 'string')),
    )
  } catch {
    return []
  }
}

function write(users: RecentUser[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(users))
  } catch {
    /* quota exceeded or storage disabled — silent fail is fine */
  }
}

/** Stable key used to dedupe and remove entries. */
function keyOf(u: RecentUser): string {
  if (u.kind === 'teller') return `teller:${u.shop_code.toUpperCase()}:${u.display_name.toLowerCase()}`
  return `${u.kind}:${u.email.toLowerCase()}`
}

/** Up to MAX_RECENT entries, most recent first. */
export function getRecentUsers(): RecentUser[] {
  return read()
    .slice()
    .sort((a, b) => b.last_used_at - a.last_used_at)
    .slice(0, MAX_RECENT)
}

/**
 * Record a successful sign-in. Dedupes by stable key (overwrites the previous
 * entry rather than creating duplicates) and trims the list to MAX_RECENT.
 */
export function recordRecentUser(input: RecentUserInput): void {
  const last_used_at = Date.now()
  const newEntry: RecentUser =
    input.kind === 'teller'
      ? { kind: 'teller', shop_code: input.shop_code, display_name: input.display_name, last_used_at }
      : { kind: input.kind, email: input.email, last_used_at }
  const key = keyOf(newEntry)
  const existing = read().filter((u) => keyOf(u) !== key)
  const next = [newEntry, ...existing].slice(0, MAX_RECENT)
  write(next)
}

/** Remove a specific entry — used by the "✕" button on each chip. */
export function removeRecentUser(target: RecentUser): void {
  const key = keyOf(target)
  write(read().filter((u) => keyOf(u) !== key))
}

/** Display label for a chip — short, single-line. */
export function labelForRecentUser(u: RecentUser): string {
  if (u.kind === 'teller') return `${u.display_name} · ${u.shop_code.toUpperCase()}`
  return u.email
}

/** Single-character avatar initial. */
export function initialForRecentUser(u: RecentUser): string {
  const source = u.kind === 'teller' ? u.display_name : u.email
  const ch = source.trim().charAt(0)
  return ch ? ch.toUpperCase() : '?'
}
