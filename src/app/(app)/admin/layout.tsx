import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/admin/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // Defense-in-depth: don't rely solely on proxy.ts (which gates on a locally
  // decoded, cookie-trusted JWT) to keep non-admins out of admin pages. Re-check
  // the server-validated user here. A DEFINITIVE non-admin (user present, wrong
  // role) is bounced; an unknown result (no user / transient error) defers to
  // middleware + every /api/admin route's requireAdmin() — so a real admin is
  // never bounced by a network blip. redirect() throws NEXT_REDIRECT, so it MUST
  // sit OUTSIDE the try/catch or the catch would swallow it.
  let user = null
  try {
    user = (await supabase.auth.getUser()).data.user
  } catch {
    user = null
  }
  const role = user?.app_metadata?.role as string | undefined
  if (user && role !== 'admin') redirect('/dashboard')

  const hasShop = !!user?.app_metadata?.shop_id

  return (
    <div>
      <AdminNav hasShop={hasShop} />
      <main className="px-4 pt-6 pb-12 max-w-4xl mx-auto">
        {children}
      </main>
    </div>
  )
}
