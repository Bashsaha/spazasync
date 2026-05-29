/**
 * Rate limiter for Next.js API routes.
 *
 * Two backends behind one async API:
 *
 *  1. **Upstash Redis** (durable) — used when `UPSTASH_REDIS_REST_URL` +
 *     `UPSTASH_REDIS_REST_TOKEN` are set. A shared store means the limit holds
 *     across all serverless instances and survives cold starts, so an attacker
 *     can't reset/spread requests to bypass it. This is the production path.
 *
 *  2. **In-memory** (fallback) — used when Upstash isn't configured (local dev,
 *     CI) or while running under Vitest. Module-level state only lives within a
 *     single serverless instance, so it's best-effort only — fine for dev.
 *
 * Fail-open: if Upstash is configured but unreachable, we allow the request
 * rather than lock out real users over a rate-limiter outage.
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

interface RateLimitOptions {
  /** Max requests allowed within the window */
  limit: number
  /** Window size in seconds */
  windowSecs: number
}

// ── In-memory fallback ─────────────────────────────────────────
interface RateLimitEntry {
  count: number
  windowStart: number
}
const store = new Map<string, RateLimitEntry>()

function checkInMemory(key: string, options: RateLimitOptions): { limited: boolean } {
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

// ── Upstash backend (lazy, cached per limit:window config) ─────
let redisClient: Redis | null | undefined
const limiterCache = new Map<string, Ratelimit>()

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  // Never use the network store under tests — keeps the suite deterministic
  // and offline.
  if (process.env.VITEST || !url || !token) {
    redisClient = null
    return null
  }
  redisClient = new Redis({ url, token })
  return redisClient
}

function getLimiter(options: RateLimitOptions): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  const cacheKey = `${options.limit}:${options.windowSecs}`
  let limiter = limiterCache.get(cacheKey)
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(options.limit, `${options.windowSecs} s`),
      // Bucket per limit:window config so endpoints with different limits don't
      // share a counter. The identifier (path:ip) further separates per route.
      prefix: `mvs-rl:${options.limit}:${options.windowSecs}`,
      analytics: false,
    })
    limiterCache.set(cacheKey, limiter)
  }
  return limiter
}

/**
 * Returns { limited: true } when the caller has exceeded the rate limit.
 * Identity is `<request path>:<client IP>` — IP read from x-forwarded-for
 * (set by Vercel's edge), path so different endpoints are throttled separately.
 */
export async function checkRateLimit(
  request: Request,
  options: RateLimitOptions,
): Promise<{ limited: boolean }> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  let path = ''
  try {
    path = new URL(request.url).pathname
  } catch {
    path = ''
  }
  const identity = `${path}:${ip}`

  const limiter = getLimiter(options)
  if (!limiter) {
    return checkInMemory(identity, options)
  }

  try {
    const { success } = await limiter.limit(identity)
    return { limited: !success }
  } catch {
    // Fail-open: an Upstash outage must not lock out legitimate users.
    return { limited: false }
  }
}
