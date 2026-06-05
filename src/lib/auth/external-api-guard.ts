import 'server-only'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/utils/rateLimit'
import { bearerMatches } from '@/lib/utils/timing-safe'

/**
 * Validates the external API Bearer token and enforces rate limiting.
 * Returns null if authorized, or a NextResponse error if not.
 *
 * The key holder can read EVERY shop's data, so the compare is constant-time
 * (bearerMatches) to deny a timing oracle on the highest-value secret.
 */
export async function requireExternalApi(request: Request): Promise<NextResponse | null> {
  const auth = request.headers.get('authorization')
  if (!bearerMatches(auth, process.env.EXTERNAL_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { limited } = await checkRateLimit(request, { limit: 60, windowSecs: 60 })
  if (limited) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  return null
}
