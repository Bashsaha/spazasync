/**
 * Phase 37c — owner-only guard for everything under /compliance.
 *
 * The proxy already redirects tellers away from this route (it's not on
 * either TELLER_* list, so they get bounced to /sale). This layout is a
 * defence-in-depth guard for any future role we add — never let a non-owner
 * see another owner's compliance pre-fill data.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ReactNode } from 'react'

export default async function ComplianceLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') redirect('/sale')

  return <>{children}</>
}
