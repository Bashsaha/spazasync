import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Verify the current session belongs to an admin user.
 * Returns the user if admin, null otherwise.
 * Used in /api/admin/* routes for server-side auth verification.
 */
export async function requireAdmin(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'admin') return null
  return user
}
