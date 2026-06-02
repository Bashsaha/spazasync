'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OfflineSyncProvider } from '@/components/OfflineSyncProvider'
import { BottomNav } from '@/components/BottomNav'
import { TopAppBar } from '@/components/TopAppBar'
import DailySummaryAlert from '@/components/DailySummaryAlert'
import { InstallPwaButton } from '@/components/InstallPwaButton'
import { ChecklistReminderFab } from '@/components/ChecklistReminderFab'
import { SaleDataWarmup } from '@/components/SaleDataWarmup'
import { ResumeGuard } from '@/components/ResumeGuard'
import { createClient } from '@/lib/supabase/client'
import { isSubscriptionExpired, subscriptionEndDate } from '@/lib/subscription/expiry'

/**
 * Client-rendered app chrome (Phase 44 App Shell, Stage 2).
 *
 * WHY THIS EXISTS: for the SW to serve `/sale` (and future shell routes)
 * instantly from cache on a cold open, the (app) layout HTML must be DATA-FREE
 * (identical for everyone — BUG-040). So the per-shop chrome — shop name, the
 * logged-in person's name, the role-specific nav/bell/FAB — can no longer be
 * baked into the server HTML. It renders here instead, sourced client-side from
 * the local session + the SW-cached /api/settings + /api/tellers/me, painted
 * instantly from a localStorage mirror on repeat opens.
 *
 * The layout STILL does the authoritative auth gate + teller lockout + locale on
 * the SERVER (network path). The two client guards below are an additive safety
 * net for the SW-CACHED-serve path (where the server never ran): a logged-out
 * user who lands on a cached shell → /login; an expired teller → /shop-suspended
 * (mirrors the server checks, via the same isSubscriptionExpired helper).
 */

type ShellRole = 'owner' | 'teller' | 'admin' | null

interface ShellIdentity {
  role: ShellRole
  shopId: string | null
  shopName: string
  personName: string | null
}

const MIRROR_KEY = 'mvs_shell_identity'
const EMPTY: ShellIdentity = { role: null, shopId: null, shopName: 'Movestock', personName: null }

function readMirror(): ShellIdentity {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = window.localStorage.getItem(MIRROR_KEY)
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<ShellIdentity>) } : EMPTY
  } catch {
    return EMPTY
  }
}

function writeMirror(v: ShellIdentity): void {
  try {
    window.localStorage.setItem(MIRROR_KEY, JSON.stringify(v))
  } catch {
    /* private mode / quota — best effort */
  }
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  // Synchronous mirror read → chrome paints correctly on the very first frame
  // for returning users (no flash of wrong name / missing nav).
  const [id, setId] = useState<ShellIdentity>(() => readMirror())

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function resolve() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (cancelled) return

        // No session → do NOTHING (no /login redirect). getSession() can return
        // null transiently on a VALID session after a tab suspension
        // (supabase#36046), so redirecting here would wrongly bounce authed
        // users. Auth is already enforced server-side (middleware + the layout
        // gate) on the network path, and the `/` splash routes genuinely
        // logged-out users to /login. RLS protects all data regardless.
        if (!session) return

        const role = (session.user.app_metadata?.role as ShellRole) ?? null
        const shopId = (session.user.app_metadata?.shop_id as string | undefined) ?? null

        const [settings, me] = await Promise.all([
          fetch('/api/settings', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch('/api/tellers/me', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ])
        if (cancelled) return

        // Teller lockout safety net (cached-serve path). Same helper the server
        // uses, so the two can't drift. Fail open if settings didn't load.
        if (
          role === 'teller' &&
          settings &&
          isSubscriptionExpired({
            status: settings.subscription_status,
            subUntil: subscriptionEndDate(
              settings.subscription_status,
              settings.trial_ends_at,
              settings.subscription_ends_at,
            ),
            accessGranted: settings.access_granted,
          })
        ) {
          router.replace('/shop-suspended')
          return
        }

        const next: ShellIdentity = {
          role,
          shopId,
          shopName: (settings?.name as string | undefined) ?? id.shopName ?? 'Movestock',
          personName: (me?.name as string | undefined) ?? null,
        }
        setId(next)
        writeMirror(next)
      } catch {
        /* leave the mirror values in place; next load retries */
      }
    }

    resolve()
    return () => {
      cancelled = true
    }
    // Run once on mount (the layout — and thus this — persists across in-app
    // navigations, so this doesn't re-fire on every tab switch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const role = id.role
  const shopId = id.shopId ?? undefined
  const isOwnerish = role === 'owner' || role === 'admin'
  const shopName = id.shopName || 'Movestock'
  const personName = id.personName
  const initial = (personName ?? shopName).trim().charAt(0).toUpperCase() || 'M'

  return (
    <>
      <ResumeGuard />
      <TopAppBar
        title={shopName}
        subtitle={personName ?? undefined}
        initial={initial}
        bellShopId={isOwnerish ? shopId : undefined}
      />
      <InstallPwaButton />
      {role !== null && role !== 'teller' && <DailySummaryAlert />}
      <OfflineSyncProvider>{children}</OfflineSyncProvider>
      {/* Until the role resolves (first-ever load), render nothing rather than a
          wrong-role bar; returning users have it in the mirror so it's instant. */}
      {role !== null && <BottomNav role={role} hasShop={!!shopId} />}
      {isOwnerish && shopId && <ChecklistReminderFab initialVisible={false} />}
      {shopId && <SaleDataWarmup />}
    </>
  )
}
