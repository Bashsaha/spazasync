'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Repeat } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clearShellIdentity } from '@/components/AppChrome'

interface Props {
  label: string
  loadingLabel: string
}

/** Signs the current user out and routes to /login so a different user
 *  (different teller, owner, etc.) can sign in. Same flow as the old
 *  TopAppBar popover, lifted into the Profile page. */
export function SwitchUserButton({ label, loadingLabel }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleSwitchUser() {
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
      onClick={handleSwitchUser}
      disabled={busy}
      className="mt-4 inline-flex items-center gap-2 bg-brand-light text-brand-hover font-semibold px-5 py-2.5 rounded-full active:bg-brand-light disabled:opacity-60"
    >
      <Repeat className="w-4 h-4" strokeWidth={2} />
      {busy ? loadingLabel : label}
    </button>
  )
}
