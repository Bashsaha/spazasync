/**
 * Format-adapter dispatch. The route calls this server-side to re-parse the
 * upload authoritatively (never trusting client-normalized rows). The same pure
 * functions also run client-side to build the preview / mapping step.
 */

import type { ColumnMap, ParsedDeposit } from '../types'
import { parseOfx } from './parse-ofx'
import { parseCsv } from './parse-csv'

export type EftFileFormat = 'ofx' | 'csv'

export function parseDeposits(
  fileText: string,
  format: EftFileFormat,
  opts: { mapping?: ColumnMap; now: Date },
): { deposits: ParsedDeposit[]; errors: string[] } {
  if (format === 'ofx') {
    return parseOfx(fileText)
  }
  const res = parseCsv(fileText, { mapping: opts.mapping, now: opts.now })
  return { deposits: res.deposits, errors: res.errors }
}

export { parseOfx } from './parse-ofx'
export {
  parseCsv,
  detectColumns,
  csvFingerprint,
  parseRows,
  splitCsvLine,
  parseDate,
  parseAmount,
} from './parse-csv'
export type { CsvParseResult, DetectResult } from './parse-csv'
