import { createClient } from '@/lib/supabase/server'
import { getAuthClaims } from '@/lib/auth/claims'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

export interface ShopAuthContext {
  user: User
  shopId: string
  supabase: SupabaseClient
}

/**
 * Authenticate the request and extract shop context. Uses getUser() — a
 * server-validated network round-trip to the auth server. Use on WRITE / admin
 * / payment endpoints where a freshly-validated user is required.
 * Returns { user, shopId, supabase } on success, null on failure.
 */
export async function getShopAuth(): Promise<ShopAuthContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) return null
  return { user, shopId, supabase }
}

export interface ShopAuthFast {
  user: { id: string; app_metadata: Record<string, unknown> }
  shopId: string
  supabase: SupabaseClient
}

/**
 * Fast read-side auth guard (Phase 45e). Verifies the JWT LOCALLY via
 * `getClaims()` (no network round-trip once asymmetric JWT signing keys are
 * enabled in the Supabase dashboard; until then it transparently falls back to a
 * network verify — no regression). Roughly halves Supabase-facing auth load on
 * the hottest GET endpoints.
 *
 * Use ONLY on read (GET) endpoints. The data-layer security boundary is still
 * RLS: every query through `supabase` re-validates the JWT at PostgREST and
 * scopes rows to the caller's shop, so even a loosely-trusted app-layer claim
 * cannot read another shop's data. WRITES keep `getShopAuth()` (getUser()).
 */
export async function getShopAuthFast(): Promise<ShopAuthFast | null> {
  const supabase = await createClient()
  const claims = await getAuthClaims(supabase)
  if (!claims) return null
  const shopId = claims.appMetadata?.shop_id as string | undefined
  if (!shopId) return null
  return { user: { id: claims.id, app_metadata: claims.appMetadata }, shopId, supabase }
}
