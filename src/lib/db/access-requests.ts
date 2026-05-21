import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type {
  AccessRequest,
  AccessRequestFeature,
  AccessRequestWithTeller,
  TellerAccessStatus,
} from '@/types'

/** Hours a 'grant' is valid for before it auto-expires (no cron — checked at read time). */
export const GRANT_DURATION_HOURS = 4

/** Compute the timestamp at which a freshly-granted access expires. */
export function computeExpiresAt(now: Date = new Date()): string {
  return new Date(now.getTime() + GRANT_DURATION_HOURS * 60 * 60 * 1000).toISOString()
}

/** True iff a 'granted' row is still active at `now`. */
export function isGrantActive(
  status: string,
  expiresAt: string | null,
  now: Date = new Date(),
): boolean {
  if (status !== 'granted') return false
  if (!expiresAt) return true // no expiry → permanent (we don't write these today)
  return new Date(expiresAt).getTime() > now.getTime()
}

// ── Owner-side ──────────────────────────────────────────────

/**
 * List access requests for the owner's shop, joined with teller name.
 * Defaults to pending only (what the bell needs); pass `status: null` for all.
 */
export async function listAccessRequestsForShop(
  supabase: SupabaseClient,
  shopId: string,
  opts: { status?: 'pending' | 'granted' | null; limit?: number } = {},
): Promise<AccessRequestWithTeller[]> {
  const { status = 'pending', limit = 50 } = opts

  let query = supabase
    .from('access_requests')
    .select('*, tellers!inner(name)')
    .eq('shop_id', shopId)
    .order('requested_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw error

  type Row = AccessRequest & { tellers: { name: string } }
  return ((data as Row[] | null) ?? []).map((row) => ({
    id: row.id,
    shop_id: row.shop_id,
    teller_id: row.teller_id,
    feature: row.feature,
    status: row.status,
    requested_at: row.requested_at,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
    expires_at: row.expires_at,
    teller_name: row.tellers?.name ?? '',
  }))
}

/**
 * List currently-active grants for the owner's shop (UI: "people who can use
 * the inventory right now"). Filters out expired-but-not-yet-cleaned-up rows
 * client-side so we don't need a cron.
 */
export async function listActiveGrantsForShop(
  supabase: SupabaseClient,
  shopId: string,
): Promise<AccessRequestWithTeller[]> {
  const all = await listAccessRequestsForShop(supabase, shopId, { status: 'granted', limit: 50 })
  const now = new Date()
  return all.filter((r) => isGrantActive(r.status, r.expires_at, now))
}

/** Owner action: grant a pending request (or re-grant after a denied/revoked). */
export async function grantAccessRequest(
  supabase: SupabaseClient,
  id: string,
  resolverId: string,
): Promise<AccessRequest> {
  const now = new Date()
  const { data, error } = await supabase
    .from('access_requests')
    .update({
      status: 'granted',
      resolved_at: now.toISOString(),
      resolved_by: resolverId,
      expires_at: computeExpiresAt(now),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as AccessRequest
}

export async function denyAccessRequest(
  supabase: SupabaseClient,
  id: string,
  resolverId: string,
): Promise<AccessRequest> {
  const { data, error } = await supabase
    .from('access_requests')
    .update({
      status: 'denied',
      resolved_at: new Date().toISOString(),
      resolved_by: resolverId,
      expires_at: null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as AccessRequest
}

export async function revokeAccessRequest(
  supabase: SupabaseClient,
  id: string,
  resolverId: string,
): Promise<AccessRequest> {
  const { data, error } = await supabase
    .from('access_requests')
    .update({
      status: 'revoked',
      resolved_at: new Date().toISOString(),
      resolved_by: resolverId,
      expires_at: null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as AccessRequest
}

// ── Teller-side ─────────────────────────────────────────────

/**
 * Look up the teller row for the current user. Tellers always have exactly
 * one row in `tellers` linked via `user_id`; returns null if not found
 * (which means caller is not a teller).
 */
async function getTellerForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ id: string; shop_id: string } | null> {
  const { data } = await supabase
    .from('tellers')
    .select('id, shop_id')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as { id: string; shop_id: string } | null) ?? null
}

/**
 * Compute the teller's current inventory access. Returns:
 *   - has_access: there's a granted, non-expired row for `inventory`
 *   - expires_at: the active grant's expiry (or null)
 *   - current_request: the most-recent row regardless of status (drives UI)
 */
export async function getTellerAccessStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<TellerAccessStatus> {
  const teller = await getTellerForUser(supabase, userId)
  if (!teller) {
    return { has_access: false, expires_at: null, current_request: null }
  }

  const { data } = await supabase
    .from('access_requests')
    .select('*')
    .eq('teller_id', teller.id)
    .eq('feature', 'inventory')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const current = (data as AccessRequest | null) ?? null
  if (!current) {
    return { has_access: false, expires_at: null, current_request: null }
  }

  const active = isGrantActive(current.status, current.expires_at)
  return {
    has_access: active,
    expires_at: active ? current.expires_at : null,
    current_request: current,
  }
}

/**
 * Lightweight boolean check used by the proxy on every teller request to
 * grant-gated paths. This runs in middleware on EVERY such request (page nav,
 * RSC prefetch, and the stock-take POST), so it's a single round-trip: we join
 * access_requests → tellers and filter on the teller's user_id directly,
 * instead of the previous two sequential queries (teller lookup, then grant
 * lookup). `tellers!inner` drops rows with no matching teller, so a non-teller
 * or unlinked user simply returns no row → false.
 */
export async function isTellerInventoryGranted(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const nowIso = new Date().toISOString()
  const { data } = await supabase
    .from('access_requests')
    .select('id, tellers!inner(user_id)')
    .eq('tellers.user_id', userId)
    .eq('feature', 'inventory')
    .eq('status', 'granted')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .limit(1)
    .maybeSingle()
  return !!data
}

/**
 * Teller submits a new pending request. Refuses to create a duplicate if
 * there's already a pending row OR an active grant for the same feature.
 */
export async function createTellerAccessRequest(
  feature: AccessRequestFeature = 'inventory',
): Promise<{ ok: true; request: AccessRequest } | { ok: false; reason: 'already_pending' | 'already_granted' | 'no_teller' }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const teller = await getTellerForUser(supabase, user.id)
  if (!teller) return { ok: false, reason: 'no_teller' }

  // Check for an existing open row.
  const status = await getTellerAccessStatus(supabase, user.id)
  if (status.current_request?.status === 'pending') {
    return { ok: false, reason: 'already_pending' }
  }
  if (status.has_access) {
    return { ok: false, reason: 'already_granted' }
  }

  const { data, error } = await supabase
    .from('access_requests')
    .insert({
      shop_id: teller.shop_id,
      teller_id: teller.id,
      feature,
      status: 'pending',
    })
    .select()
    .single()
  if (error) throw error

  return { ok: true, request: data as AccessRequest }
}
