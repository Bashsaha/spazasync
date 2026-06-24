import type { DailyChecklist, ChecklistStats } from '@/types'

/** Classify whether a fridge temperature is within R638's ≤5°C limit.
 *  R638 mandates only the upper bound — there is no regulatory lower limit,
 *  so we only flag temps above 5°C (not below 1°C). */
export function fridgeInRange(temp: number | null): boolean {
  if (temp === null) return true // unknown = not flagged
  return temp <= 5
}

/** Classify whether a freezer temperature is at or below -18°C. */
export function freezerInRange(temp: number | null): boolean {
  if (temp === null) return true
  return temp <= -18
}

/**
 * Consecutive-day daily-checklist streak (the dashboard "🔥 N-day" habit chip).
 *
 * `dates` = the dates a checklist was completed (YYYY-MM-DD, any order, may
 * contain duplicates). `today` = SAST today (YYYY-MM-DD).
 *
 * The streak is the run of consecutive days ending at today — OR at yesterday
 * when today's checklist isn't done yet (the streak is still "alive", we just
 * nudge them to keep it). A gap of a full missed day breaks it back to 0.
 */
export function computeChecklistStreak(
  dates: string[],
  today: string,
): { streak: number; completedToday: boolean } {
  const set = new Set(dates)
  const completedToday = set.has(today)
  const DAY_MS = 86_400_000
  const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10)

  const todayMs = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(todayMs)) return { streak: 0, completedToday }

  let cursor: number
  if (completedToday) {
    cursor = todayMs
  } else if (set.has(ymd(todayMs - DAY_MS))) {
    cursor = todayMs - DAY_MS // not done today, but yesterday — streak still alive
  } else {
    return { streak: 0, completedToday: false }
  }

  let streak = 0
  while (set.has(ymd(cursor))) {
    streak += 1
    cursor -= DAY_MS
  }
  return { streak, completedToday }
}

/** Compute compliance stats across a list of checklist rows over a window. */
export function computeChecklistStats(
  rows: DailyChecklist[],
  totalDays = 30,
): ChecklistStats {
  const completedDays = rows.length
  const compliancePct =
    totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0

  if (completedDays === 0) {
    return {
      completedDays: 0,
      totalDays,
      compliancePct,
      cleaningRate: 0,
      avgFridgeTemp: null,
      avgFreezerTemp: null,
      outOfRangeDays: 0,
    }
  }

  let cleaningDays = 0
  let fridgeSum = 0
  let fridgeN = 0
  let freezerSum = 0
  let freezerN = 0
  let outOfRange = 0

  for (const r of rows) {
    if (r.surfaces_cleaned && r.floor_cleaned && r.storage_clean) {
      cleaningDays += 1
    }
    if (r.fridge_temp !== null) {
      fridgeSum += Number(r.fridge_temp)
      fridgeN += 1
    }
    if (r.freezer_temp !== null) {
      freezerSum += Number(r.freezer_temp)
      freezerN += 1
    }
    const fridgeBad =
      r.fridge_temp !== null && !fridgeInRange(Number(r.fridge_temp))
    const freezerBad =
      r.freezer_temp !== null && !freezerInRange(Number(r.freezer_temp))
    if (fridgeBad || freezerBad) outOfRange += 1
  }

  return {
    completedDays,
    totalDays,
    compliancePct,
    cleaningRate: Math.round((cleaningDays / completedDays) * 100),
    avgFridgeTemp:
      fridgeN > 0 ? Math.round((fridgeSum / fridgeN) * 10) / 10 : null,
    avgFreezerTemp:
      freezerN > 0 ? Math.round((freezerSum / freezerN) * 10) / 10 : null,
    outOfRangeDays: outOfRange,
  }
}
