'use client'

import { useState } from 'react'
import { Repeat } from 'lucide-react'
import { signOutAndPurge } from '@/lib/offline/sign-out'
import { Button } from '@/components/ui'

interface Props {
  label: string
  loadingLabel: string
}

/**
 * Sign out → /login so a different user (the owner, or a teller from another
 * shop) can sign in. Hard navigation after signOut (per BUG-043): never reach
 * the next authenticated render via a soft router.push right after a
 * client-side auth transition — the cookie write races the RSC fetch.
 */
export function ShopSuspendedActions({ label, loadingLabel }: Props) {
  const [busy, setBusy] = useState(false)

  async function handleSwitchUser() {
    if (busy) return
    setBusy(true)
    try {
      // Purge all shop/user-scoped caches (SECURITY-001): this screen is the
      // owner⇄teller phone hand-off, the exact shared-device switch the leak
      // was filed against.
      await signOutAndPurge()
    } finally {
      window.location.assign('/login')
    }
  }

  return (
    <Button
      fullWidth
      size="lg"
      variant="outline"
      icon={Repeat}
      loading={busy}
      onClick={handleSwitchUser}
    >
      {busy ? loadingLabel : label}
    </Button>
  )
}
