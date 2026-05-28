/**
 * OFX adapter (primary / recommended).
 *
 * OFX is an interbank standard with named fields, so it is immune to the CSV
 * layout churn banks inflict on their exports. We parse the SGML loosely with
 * regex (OFX tags are frequently left unclosed), pulling each <STMTTRN> block's
 * <DTPOSTED>, <TRNAMT>, <NAME>/<MEMO>. Credits only.
 */

import type { ParsedDeposit } from '../types'

/** First value of a (possibly unclosed) OFX tag inside a transaction block. */
function tagValue(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'))
  return m ? m[1].trim() : null
}

export function parseOfx(text: string): { deposits: ParsedDeposit[]; errors: string[] } {
  const errors: string[] = []
  const deposits: ParsedDeposit[] = []

  // Split on the opening tag — works whether or not </STMTTRN> is present.
  const blocks = text.split(/<STMTTRN>/i).slice(1)
  if (blocks.length === 0) {
    return { deposits, errors: ['No transactions found in the OFX file.'] }
  }

  blocks.forEach((block, i) => {
    const dt = tagValue(block, 'DTPOSTED')
    const amtRaw = tagValue(block, 'TRNAMT')
    const name = tagValue(block, 'NAME') ?? ''
    const memo = tagValue(block, 'MEMO') ?? ''

    if (!dt || dt.length < 8 || !amtRaw) {
      errors.push(`Transaction ${i + 1}: missing date or amount — skipped.`)
      return
    }

    const amount = parseFloat(amtRaw.replace(/[^0-9.\-]/g, ''))
    if (isNaN(amount)) {
      errors.push(`Transaction ${i + 1}: unreadable amount "${amtRaw}" — skipped.`)
      return
    }
    if (amount <= 0) return // credits (deposits) only

    const date = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`
    const reference = [name, memo].filter(Boolean).join(' ').trim()

    deposits.push({
      date,
      amount,
      reference,
      rawDescription: reference,
      lineNo: i + 1,
    })
  })

  return { deposits, errors }
}
