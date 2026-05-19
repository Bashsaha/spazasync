import { SUPPORTED_LOCALES } from './types'
import type { SupportedLocale } from './types'

/** Shared cookie name used by both server (read in layout) and client
 *  (write in LanguageProvider.setLocale). Locale is NOT a security boundary —
 *  it only controls which translation file is rendered. It is therefore safe
 *  to expose to JS (no httpOnly) so the LanguagePicker can update it without
 *  an extra round trip. */
export const LOCALE_COOKIE = 'mvs_locale'

/** One year — locale preference shouldn't churn. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Narrow an arbitrary string to a SupportedLocale, or null if invalid. */
export function parseLocale(value: string | undefined | null): SupportedLocale | null {
  if (!value) return null
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
    ? (value as SupportedLocale)
    : null
}

/** Attributes to set the cookie from a Response.cookies.set() call.
 *  `secure` should be true in production; we read NODE_ENV here so callers
 *  don't need to remember. */
export function localeCookieOptions() {
  return {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax' as const,
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  }
}

/** Build a Set-Cookie header value for response.headers.append(...). */
export function buildLocaleCookieHeader(locale: SupportedLocale): string {
  const attrs = [
    `${LOCALE_COOKIE}=${locale}`,
    'Path=/',
    `Max-Age=${LOCALE_COOKIE_MAX_AGE}`,
    'SameSite=Lax',
  ]
  if (process.env.NODE_ENV === 'production') attrs.push('Secure')
  return attrs.join('; ')
}
