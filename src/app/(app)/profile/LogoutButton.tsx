'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clearShellIdentity } from '@/components/AppChrome'

interface Props {
  label: string
  loadingLabel: string
}

/** Sign-out + route to /login. Same call-shape as SwitchUserButton — kept
 *  separate so the icon and visual weight (red-tinted destructive row vs
 *  brand-tinted CTA pill) can diverge. */
export function LogoutButton({ label, loadingLabel }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleLogout() {
    if (busy) return
    setBusy(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } finally {
      clearShellIdentity()
      router.push('/login')
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-red-600 active:bg-red-50 disabled:opacity-60"
    >
      <LogOut className="w-5 h-5 shrink-0" strokeWidth={1.75} />
      <span className="text-sm font-semibold">{busy ? loadingLabel : label}</span>
    </button>
  )
}
