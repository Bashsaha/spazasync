/**
 * Simple in-memory rate limiter for Next.js API routes.
 *
 * NOTE: Module-level state only persists within a single cold-started
 * serverless function instance. This provides meaningful protection against
 * casual abuse; replace with Vercel KV + @upstash/ratelimit before a
 * high-traffic production launch (Phase 12 concern).
 */

interface RateLimitEntry {
  count: number
  windowStart: number
}

const store = new Map<string, RateLimitEntry>()

interface RateLimitOptions {
  /** Max requests allowed within the window */
  limit: number
  /** Window size in seconds */
  windowSecs: number
}

/**
 * Returns { limited: true } when the caller has exceeded the rate limit.
 * Reads the client IP from x-forwarded-for (set by Vercel's edge).
 */
export function checkRateLimit(request: Request, options: RateLimitOptions): { limited: boolean } {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const key = `${ip}`
  const now = Date.now()
  const windowMs = options.windowSecs * 1000

  const entry = store.get(key)

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now })
    return { limited: false }
  }

  entry.count += 1

  if (entry.count > options.limit) {
    return { limited: true }
  }

  return { limited: false }
}
