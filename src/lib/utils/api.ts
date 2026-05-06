import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

/**
 * Cache-Control headers for stable read endpoints. Browser keeps the response
 * for `maxAge` seconds AND may serve stale up to `staleWhileRevalidate` seconds
 * while refreshing in the background. `private` ensures CDNs don't cache
 * per-user data. Layered on top of the SW SWR cache for repeat-fetch wins.
 */
export const STABLE_READ_CACHE = {
  'Cache-Control': 'private, max-age=30, stale-while-revalidate=300',
} as const

/**
 * Parse JSON body and validate against a Zod schema.
 * Returns parsed data on success, or a NextResponse error.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T | NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  return parsed.data
}
