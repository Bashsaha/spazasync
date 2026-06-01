import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Allow images from Supabase storage
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  experimental: {
    // Client-side Router Cache lifetimes — the dominant lever for the
    // resume-from-background "tap a tab → 2-3 min frozen, no spinner" stall.
    //
    // A bottom-nav tap is a client-side navigation that fetches an RSC payload.
    // That fetch has NO timeout and bypasses the service worker (BUG-039), so on
    // a just-foregrounded phone (radio still asleep) it sits queued — the
    // navigation never commits, so loading.tsx never even paints. With the old
    // 30s/180s windows, every tab went stale within seconds of backgrounding, so
    // EVERY resume tap re-fetched into the dead radio.
    //
    // Holding visited tabs (`dynamic`) + their prefetched loading shells
    // (`static`) for 30 min means a tab opened earlier this session re-opens
    // INSTANTLY from the in-memory Router Cache on resume — no network, no radio
    // dependency, no frozen screen. Freshness is preserved out-of-band:
    //   - cache-first screens (useCachedData) revalidate on RESUME_READY,
    //   - mutations force-refresh via the DATA_CHANGED event bus + realtime,
    //   - non-converted pages self-heal via useRefetchOnVisible → router.refresh
    //     on RESUME_READY — all in the BACKGROUND, after ResumeGuard confirms the
    //     connection is up, so none of it blocks the paint.
    // (Phase 44a foundation; widened for the resume-navigation stall, 2026-06-01.)
    staleTimes: {
      dynamic: 1800,
      static: 1800,
    },
  },
  // Security headers managed in vercel.json (single source of truth)
};

export default nextConfig;
