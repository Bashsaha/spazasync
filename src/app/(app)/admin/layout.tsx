import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/admin/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
