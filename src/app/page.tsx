import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Root page — redirect based on auth state.
 * Middleware handles most redirects, but this covers the root path.
 */
export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.app_metadata?.role as string | undefined

  if (!role) redirect('/onboarding')
  if (role === 'teller') redirect('/sale')

  redirect('/dashboard')
}
