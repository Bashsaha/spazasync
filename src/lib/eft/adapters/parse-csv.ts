/**
 * CSV adapter (fallback) — resilient to bank layout changes.
 *
 * Banks reshuffle/rename CSV columns often, so we DON'T pin to fixed positions.
 * Columns are detected by CONTENT (which column parses as dates, which as
 * numbers, which is the longest free text) plus fuzzy header-name matching. The
 * UI confirms/corrects the proposed mapping and saves it (keyed by a header
 * fingerprint); a layout change yields a new fingerprint and re-prompts.
 *
 * Handles FNB quirks: multi-section files (metadata/summary rows simply fail to
 * parse as date+amount and are skipped), year-less dates, and Afrikaans month
 * abbreviations (Mrt/Mei/Okt/Des).
 */

import type { ColumnMap, ParsedDeposit } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, mrt: 3, apr: 4, may: 5, mei: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12,
}

// ── Low-level CSV ────────────────────────────────────────────────────────────

/** Quote-aware split of a single CSV line (handles commas inside quotes + "" escapes). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

export function parseRows(text: string): string[][] {
  return text
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim().length > 0)
    .map(splitCsvLine)
}

// ── Field parsing ────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

function inferYear(month: number, day: number, now: Date): number {
  const y = now.getFullYear()
  const candidate = new Date(y, month - 1, day)
  // A date more than ~2 days in the future must belong to the previous year
  // (handles statements spanning the Dec→Jan boundary).
  if (candidate.getTime() - now.getTime() > 2 * DAY_MS) return y - 1
  return y
}

export function parseDate(raw: string, now: Date): string | null {
  const s = (raw || '').trim()
  if (!s) return null

  // ISO: YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) return toIso(+m[1], +m[2], +m[3])

  // SA: DD/MM/YYYY or DD-MM-YYYY (also 2-digit year)
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
  if (m) {
    let y = +m[3]
    if (y < 100) y += 2000
    return toIso(y, +m[2], +m[1])
  }

  // DD MMM [YYYY] — English + Afrikaans abbreviations, optional year
  m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s-]*(\d{2,4})?$/)
  if (m) {
    const mon = MONTHS[m[2].toLowerCase().slice(0, 3)]
    if (!mon) return null
    const day = +m[1]
    let year: number
    if (m[3]) {
      year = +m[3] < 100 ? 2000 + +m[3] : +m[3]
    } else {
      year = inferYear(mon, day, now)
    }
    return toIso(year, mon, day)
  }

  return null
}

/**
 * Strict test for column detection: does the WHOLE cell look like a money
 * value? Unlike `parseAmount` (which leniently strips letters for extraction),
 * this rejects cells containing letters (e.g. a "CAPE99" reference) or a date,
 * so the reference column isn't mistaken for the amount column.
 */
export function looksNumeric(raw: string): boolean {
  const s = (raw || '').trim()
  if (!s || !/\d/.test(s)) return false
  if (/[A-Za-z]/.test(s.replace(/^R/i, ''))) return false
  return /^[-(]?\s*R?[\d., ]+\)?$/.test(s)
}

/** Parse a money cell to a signed number (parentheses or leading "-" = debit). */
export function parseAmount(raw: string): number | null {
  let s = (raw || '').trim()
  if (!s) return null
  const negative = s.startsWith('-') || (s.startsWith('(') && s.endsWith(')'))
  s = s.replace(/[^0-9.,]/g, '').replace(/,/g, '') // strip R/spaces, treat comma as thousands
  if (!s || !/\d/.test(s)) return null
  const n = parseFloat(s)
  if (isNaN(n)) return null
  return negative ? -Math.abs(n) : Math.abs(n)
}

// ── Column detection ─────────────────────────────────────────────────────────

const HEADER_RE = {
  date: /date|datum/i,
  amount: /amount|amt|bedrag|debit|credit|value/i,
  reference: /desc|reference|narrative|detail|memo|payee|particular/i,
}

function modalWidth(rows: string[][]): number {
  const counts = new Map<number, number>()
  for (const r of rows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1)
  let best = 0
  let bestCount = -1
  for (const [w, c] of counts) {
    if (w >= 3 && c > bestCount) {
      best = w
      bestCount = c
    }
  }
  return best
}

export interface DetectResult {
  map: ColumnMap | null
  confidence: number
  headerRowIndex: number
  /** Column header labels when a header row was found, else generated names. */
  headers: string[]
}

export function detectColumns(rows: string[][], now: Date): DetectResult {
  // 1. Find a header row in the first few rows.
  let headerRowIndex = -1
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const r = rows[i]
    if (r.some((c) => HEADER_RE.date.test(c)) && r.some((c) => HEADER_RE.amount.test(c))) {
      headerRowIndex = i
      break
    }
  }

  const startData = headerRowIndex >= 0 ? headerRowIndex + 1 : 0
  const after = rows.slice(startData).filter((r) => r.length >= 3)
  const width = modalWidth(after)
  const data = after.filter((r) => r.length === width)

  const headers =
    headerRowIndex >= 0 && rows[headerRowIndex].length === width
      ? rows[headerRowIndex]
      : Array.from({ length: width }, (_, i) => `Column ${i + 1}`)

  if (width < 3 || data.length === 0) {
    return { map: null, confidence: 0, headerRowIndex, headers }
  }

  const dateScore: number[] = []
  const numScore: number[] = []
  const textLen: number[] = []
  for (let c = 0; c < width; c++) {
    let dates = 0
    let nums = 0
    let textTotal = 0
    let textCells = 0
    for (const r of data) {
      const cell = r[c] ?? ''
      // Mutually-exclusive classification: date > number > free text.
      if (parseDate(cell, now)) dates++
      else if (looksNumeric(cell)) nums++
      else if (cell.trim()) {
        textTotal += cell.trim().length
        textCells++
      }
    }
    dateScore[c] = dates / data.length
    numScore[c] = nums / data.length
    textLen[c] = textCells > 0 ? textTotal / textCells : 0
  }

  const argmax = (arr: number[], skip: number[] = [], min = 0): number => {
    let best = -1
    let bestVal = min
    for (let c = 0; c < arr.length; c++) {
      if (skip.includes(c)) continue
      if (arr[c] > bestVal) {
        bestVal = arr[c]
        best = c
      }
    }
    return best
  }

  let dateCol = argmax(dateScore, [], 0.5)
  let amountCol = argmax(numScore, dateCol >= 0 ? [dateCol] : [], 0.5)
  let refCol = argmax(textLen, [dateCol, amountCol].filter((c) => c >= 0), 0)

  // Header names override content detection when explicit.
  if (headerRowIndex >= 0) {
    rows[headerRowIndex].forEach((h, c) => {
      if (c >= width) return
      if (HEADER_RE.date.test(h) && dateScore[c] > 0.3) dateCol = c
      else if (HEADER_RE.reference.test(h)) refCol = c
    })
    // amount only from header if it still looks numeric
    rows[headerRowIndex].forEach((h, c) => {
      if (c >= width) return
      if (HEADER_RE.amount.test(h) && numScore[c] > 0.3 && c !== dateCol) amountCol = c
    })
  }

  if (dateCol < 0 || amountCol < 0 || refCol < 0) {
    return { map: null, confidence: 0, headerRowIndex, headers }
  }

  const confidence = Math.min(dateScore[dateCol], numScore[amountCol])
  return {
    map: { date: dateCol, amount: amountCol, reference: refCol },
    confidence,
    headerRowIndex,
    headers,
  }
}

// ── Top-level parse ──────────────────────────────────────────────────────────

export interface CsvParseResult {
  deposits: ParsedDeposit[]
  errors: string[]
  mapping: ColumnMap | null
  confidence: number
  headers: string[]
}

export function parseCsv(
  text: string,
  opts: { mapping?: ColumnMap; now: Date },
): CsvParseResult {
  const rows = parseRows(text)
  if (rows.length === 0) {
    return { deposits: [], errors: ['The file is empty.'], mapping: null, confidence: 0, headers: [] }
  }

  let map = opts.mapping ?? null
  let confidence = 1
  let headers: string[] = []

  if (!map) {
    const det = detectColumns(rows, opts.now)
    map = det.map
    confidence = det.confidence
    headers = det.headers
    if (!map) {
      return {
        deposits: [],
        errors: ['Could not detect the date / amount / reference columns. Confirm the columns and try again.'],
        mapping: null,
        confidence: 0,
        headers,
      }
    }
  } else {
    headers = detectColumns(rows, opts.now).headers
  }

  const deposits: ParsedDeposit[] = []
  const maxIdx = Math.max(map.date, map.amount, map.reference)
  rows.forEach((r, i) => {
    if (r.length <= maxIdx) return // metadata / short rows
    const date = parseDate(r[map!.date], opts.now)
    const amount = parseAmount(r[map!.amount])
    if (!date || amount === null) return // header / summary / non-data rows
    if (amount <= 0) return // credits only
    const reference = (r[map!.reference] || '').trim()
    deposits.push({ date, amount, reference, rawDescription: reference, lineNo: i + 1 })
  })

  return { deposits, errors: [], mapping: map, confidence, headers }
}

/** Stable fingerprint of a CSV's shape — used to key the saved column mapping. */
export function csvFingerprint(text: string): string {
  const rows = parseRows(text)
  const header = rows.find((r) => r.length >= 3)
  const basis = header
    ? `${header.map((c) => c.toLowerCase().replace(/[^a-z]/g, '')).join('|')}:${header.length}`
    : 'unknown'
  // FNV-1a 32-bit → hex
  let h = 0x811c9dc5
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}
