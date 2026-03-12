import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OfflineSyncProvider } from '@/components/OfflineSyncProvider'
import { ToastProvider } from '@/components/Toast'
import { BottomNav } from '@/components/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = (user.app_metadata?.role as string) ?? 'owner'

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastProvider>
        <OfflineSyncProvider>
          {children}
        </OfflineSyncProvider>
        <BottomNav role={role} />
      </ToastProvider>
    </div>
  )
}
