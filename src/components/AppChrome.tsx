'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
import { SUBSCRIPTION_EXEMPT } from '@/lib/auth/route-access'

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
  /** Which auth user this mirror belongs to. Lets us discard a previous user's
   *  cached chrome (e.g. teller→owner switch on the same device) instead of
   *  showing their name/role until a manual reload. */
  userId: string | null
  role: ShellRole
  shopId: string | null
  shopName: string
  personName: string | null
}

const MIRROR_KEY = 'mvs_shell_identity'
const EMPTY: ShellIdentity = {
  userId: null,
  role: null,
  shopId: null,
  shopName: 'Movestock',
  personName: null,
}

/** Wipe the cached chrome identity. Call on sign-out so the next user never
 *  sees the previous person's name/role flash before resolve() runs. */
export function clearShellIdentity(): void {
  try {
    window.localStorage.removeItem(MIRROR_KEY)
  } catch {
    /* private mode / quota — best effort */
  }
}

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
  const pathname = usePathname()
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

        const userId = session.user.id
        const role = (session.user.app_metadata?.role as ShellRole) ?? null
        const shopId = (session.user.app_metadata?.shop_id as string | undefined) ?? null

        // If the cached mirror belongs to a DIFFERENT user (teller→owner switch
        // on the same device), drop its stale display values NOW so we never
        // render the previous person's name/role while the fresh fetch is in
        // flight. shopName is kept only when the shop is unchanged.
        if (id.userId && id.userId !== userId) {
          setId({ ...EMPTY, userId, role, shopId })
        }

        // Owner subscription gate — mirrors the middleware gate (proxy.ts) for
        // the SW-cached-serve path (where middleware never ran). JWT-only, so no
        // fetch. Exempt paths (/subscribe, /settings, …) are skipped → no loop.
        // Tellers are handled by the lockout below; admins skip (like middleware).
        if (
          role === 'owner' &&
          !SUBSCRIPTION_EXEMPT.some((r) => pathname.startsWith(r)) &&
          isSubscriptionExpired({
            status: session.user.app_metadata?.sub_status as string | undefined,
            subUntil: session.user.app_metadata?.sub_until as string | undefined,
            accessGranted: session.user.app_metadata?.access_granted as boolean | undefined,
          })
        ) {
          router.replace('/subscribe')
          return
        }

        // `/api/tellers/me` is SWR-cached by the service worker under a
        // user-less URL, so after a user switch the SW would serve the previous
        // person's cached row. Scoping the URL by userId gives each user their
        // own cache entry — no cross-user leak (the "owner shows the teller's
        // name" bug). The endpoint ignores the extra param.
        const [settings, me] = await Promise.all([
          fetch('/api/settings', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch(`/api/tellers/me?u=${encodeURIComponent(userId)}`, { cache: 'no-store' })
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
          userId,
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
