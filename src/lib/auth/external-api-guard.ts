import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/utils/rateLimit'

/**
 * Validates the external API Bearer token and enforces rate limiting.
 * Returns null if authorized, or a NextResponse error if not.
 */
export function requireExternalApi(request: Request): NextResponse | null {
  const auth = request.headers.get('authorization')
  if (!process.env.EXTERNAL_API_KEY || auth !== `Bearer ${process.env.EXTERNAL_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { limited } = checkRateLimit(request, { limit: 60, windowSecs: 60 })
  if (limited) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  return null
}
