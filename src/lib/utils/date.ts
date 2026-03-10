/**
 * Date/time utilities for SpazaSync.
 * All user-facing times are shown in SAST (Africa/Johannesburg, UTC+2).
 * Cron jobs fire at 18:00 UTC = 20:00 SAST.
 */

import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { startOfDay, endOfDay, format } from 'date-fns'

export const SAST_TZ = 'Africa/Johannesburg'

/**
 * Get the current date/time in SAST.
 */
export function nowSAST(): Date {
  return toZonedTime(new Date(), SAST_TZ)
}

/**
 * Format a date string or Date object for display in SAST.
 * @example formatSAST(new Date(), 'dd MMM yyyy HH:mm') → "10 Mar 2026 20:00"
 */
export function formatSAST(date: Date | string, fmt: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatInTimeZone(d, SAST_TZ, fmt)
}

/**
 * Get the start of today in SAST as a UTC Date (for Supabase queries).
 */
export function startOfTodaySAST(): Date {
  const todaySAST = startOfDay(nowSAST())
  return todaySAST
}

/**
 * Get the end of today in SAST as a UTC Date (for Supabase queries).
 */
export function endOfTodaySAST(): Date {
  const todaySAST = endOfDay(nowSAST())
  return todaySAST
}

/**
 * Format a date as a short human-readable string in SAST.
 * @example shortDate(new Date()) → "Mon, 10 Mar"
 */
export function shortDate(date: Date | string): string {
  return formatSAST(date, 'EEE, dd MMM')
}

/**
 * Format a time in SAST for display.
 * @example shortTime(new Date()) → "20:00"
 */
export function shortTime(date: Date | string): string {
  return formatSAST(date, 'HH:mm')
}

/**
 * Returns true if the given ISO string falls within today in SAST.
 */
export function isToday(isoString: string): boolean {
  const d = toZonedTime(new Date(isoString), SAST_TZ)
  const today = nowSAST()
  return format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
}
