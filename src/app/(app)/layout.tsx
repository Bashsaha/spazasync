import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OfflineSyncProvider } from '@/components/OfflineSyncProvider'

/**
 * App shell layout — wraps all authenticated app routes.
 * Bottom navigation is added in Phase 11 (Polish).
 * Tellers are excluded here by middleware — they only see /sale.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <OfflineSyncProvider>
        {children}
      </OfflineSyncProvider>
    </div>
  )
}
