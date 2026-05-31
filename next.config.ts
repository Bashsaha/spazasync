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
    // Client-side Router Cache lifetimes. `dynamic` defaults to 0s (Next 15+),
    // so every back-and-forth between tabs re-fetches the RSC payload from the
    // server — re-running the layout's auth + DB queries each time. Caching
    // dynamic segments for 30s lets idle tab-switches reuse the cached payload
    // (instant, no server round-trip, no risk of hitting a sleeping radio).
    // Mutations still force-refresh via the DATA_CHANGED event bus + realtime,
    // so this only affects passive re-navigation. (Phase 44a)
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  // Security headers managed in vercel.json (single source of truth)
};

export default nextConfig;
