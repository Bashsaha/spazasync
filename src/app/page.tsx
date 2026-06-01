import { Spinner } from '@/components/Spinner'
import { LaunchRouter } from '@/components/LaunchRouter'

/**
 * Root `/` — the App Shell entry (Phase 44, Stage 1).
 *
 * DATA-FREE on purpose: no auth, no DB, no cookies. The HTML is identical for
 * everyone (the only per-request value is the root layout's CSP nonce, which is
 * security infra, not user data, and is cached together with its CSP header so
 * the copy stays self-consistent), so the service worker can precache it and
 * serve it INSTANTLY on a cold open (the manifest `start_url`) — a branded
 * splash instead of a white screen while the radio wakes (BUG-040-safe: nothing
 * per-user is cached). The client `<LaunchRouter>` then reads the LOCAL session
 * (no network) and soft-routes to /dashboard | /sale | /onboarding | /login.
 *
 * NOT `force-static`: the root layout reads headers() for the CSP nonce, which
 * opts the tree into dynamic rendering. That's fine — the page renders fast
 * (no data) and the SW serves the cached copy instantly regardless.
 */
export default function RootPage() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center gap-5 px-6">
      <h1 className="text-3xl font-bold text-brand tracking-tight">Movestock</h1>
      <Spinner size="lg" className="text-brand" />
      <LaunchRouter />
    </main>
  )
}
