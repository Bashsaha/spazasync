import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkRateLimit } from '@/lib/utils/rateLimit'

// Helper: create a Request with a specific IP via x-forwarded-for header
function makeRequest(ip: string): Request {
  return new Request('http://localhost/api/test', {
    headers: { 'x-forwarded-for': ip },
  })
}

// Use a counter to generate unique IPs so tests don't share state
let ipCounter = 1
function freshIp(): string {
  return `10.0.0.${ipCounter++}`
}

// Under Vitest, checkRateLimit always uses the in-memory backend (the Upstash
// path is disabled when process.env.VITEST is set), so these tests stay
// deterministic and offline while still exercising the public async API.
describe('checkRateLimit (in-memory backend)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows first request', async () => {
    const ip = freshIp()
    const result = await checkRateLimit(makeRequest(ip), { limit: 3, windowSecs: 60 })
    expect(result.limited).toBe(false)
  })

  it('allows requests up to the limit', async () => {
    const ip = freshIp()
    const opts = { limit: 5, windowSecs: 60 }
    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit(makeRequest(ip), opts)
      expect(result.limited).toBe(false)
    }
  })

  it('blocks request that exceeds the limit', async () => {
    const ip = freshIp()
    const opts = { limit: 3, windowSecs: 60 }
    // First 3 allowed
    await checkRateLimit(makeRequest(ip), opts)
    await checkRateLimit(makeRequest(ip), opts)
    await checkRateLimit(makeRequest(ip), opts)
    // 4th is over limit
    const result = await checkRateLimit(makeRequest(ip), opts)
    expect(result.limited).toBe(true)
  })

  it('resets after the window expires', async () => {
    const ip = freshIp()
    const opts = { limit: 2, windowSecs: 60 }

    // Exhaust the limit
    await checkRateLimit(makeRequest(ip), opts)
    await checkRateLimit(makeRequest(ip), opts)
    const blocked = await checkRateLimit(makeRequest(ip), opts)
    expect(blocked.limited).toBe(true)

    // Advance time past the 60-second window
    vi.advanceTimersByTime(61 * 1000)

    // Should reset
    const afterReset = await checkRateLimit(makeRequest(ip), opts)
    expect(afterReset.limited).toBe(false)
  })

  it('tracks different IPs independently', async () => {
    const ip1 = freshIp()
    const ip2 = freshIp()
    const opts = { limit: 1, windowSecs: 60 }

    // Exhaust ip1
    await checkRateLimit(makeRequest(ip1), opts)
    const blockedIp1 = await checkRateLimit(makeRequest(ip1), opts)
    expect(blockedIp1.limited).toBe(true)

    // ip2 is separate and unaffected
    const ip2Result = await checkRateLimit(makeRequest(ip2), opts)
    expect(ip2Result.limited).toBe(false)
  })

  it('tracks different endpoints (paths) independently', async () => {
    const ip = freshIp()
    const opts = { limit: 1, windowSecs: 60 }
    const reqA = new Request('http://localhost/api/a', { headers: { 'x-forwarded-for': ip } })
    const reqB = new Request('http://localhost/api/b', { headers: { 'x-forwarded-for': ip } })

    // Exhaust path /api/a for this IP
    await checkRateLimit(reqA, opts)
    expect((await checkRateLimit(reqA, opts)).limited).toBe(true)

    // Same IP on a different path is a separate bucket
    expect((await checkRateLimit(reqB, opts)).limited).toBe(false)
  })

  it('uses first IP from comma-separated x-forwarded-for', async () => {
    const ip = freshIp()
    const proxiedRequest = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': `${ip}, 192.168.1.1, 10.0.0.1` },
    })
    const opts = { limit: 1, windowSecs: 60 }

    await checkRateLimit(proxiedRequest, opts)
    const blocked = await checkRateLimit(proxiedRequest, opts)
    expect(blocked.limited).toBe(true)
  })

  it('falls back to "unknown" when no x-forwarded-for header', async () => {
    const opts = { limit: 100, windowSecs: 60 }
    // Only checking it does not throw
    const request = new Request('http://localhost/api/test')
    const result = await checkRateLimit(request, opts)
    expect(result).toHaveProperty('limited')
  })
})
