/** Tiny class-name joiner. Filters out falsy values so callers can write
 *  `cx('base', condition && 'extra', size === 'sm' && 'text-xs')` without
 *  any extra ceremony. No new dependency — clsx and tailwind-merge are
 *  unnecessary for our surface area. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
