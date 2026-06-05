import { createHash, timingSafeEqual } from 'crypto'

/**
 * Constant-time string comparison.
 *
 * A plain `a === b` / `a !== b` on a secret short-circuits on the first
 * differing byte, leaking a timing oracle an attacker can use to recover the
 * secret byte-by-byte. We hash both sides to a fixed 32-byte SHA-256 digest
 * first, so the `timingSafeEqual` compare is always over equal-length buffers
 * (no length-mismatch throw, and the input length itself isn't leaked).
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/**
 * Constant-time check of an `Authorization: Bearer <token>` header against a
 * secret. Fails closed when the secret is unset or the header is missing /
 * malformed. Use for the external-API key and the cron secret.
 */
export function bearerMatches(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret) return false
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false
  return safeEqual(authHeader.slice('Bearer '.length), secret)
}
