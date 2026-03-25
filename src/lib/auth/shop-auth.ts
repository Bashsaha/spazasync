import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

export interface ShopAuthContext {
  user: User
  shopId: string
  supabase: SupabaseClient
}

/**
 * Authenticate the request and extract shop context.
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
