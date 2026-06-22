import { describe, it, expect } from 'vitest'
import {
  normalizeRef,
  findShopCodes,
  monthsFromAmount,
  computeRenewalEnd,
  dedupeKey,
  classifyDeposit,
} from '@/lib/eft/match'
import { parseOfx } from '@/lib/eft/adapters/parse-ofx'
import { parseCsv, parseDate, parseAmount, detectColumns, parseRows } from '@/lib/eft/adapters/parse-csv'
import type { ParsedDeposit, ShopSubInfo } from '@/lib/eft/types'

const PRICE = 349.99
const NOW = new Date('2026-05-28T10:00:00Z')

function deposit(over: Partial<ParsedDeposit> = {}): ParsedDeposit {
  return {
    date: '2026-05-20',
    amount: PRICE,
    reference: 'CAPE99',
    rawDescription: 'CAPE99',
    lineNo: 1,
    ...over,
  }
}

function shop(over: Partial<ShopSubInfo> = {}): ShopSubInfo {
  return {
    id: 'shop-1',
    code: 'CAPE99',
    name: 'Cape Spaza',
    subscription_status: 'expired',
    subscription_ends_at: null,
    trial_ends_at: null,
    ...over,
  }
}

function roster(shops: ShopSubInfo[]) {
  const byCode = new Map<string, ShopSubInfo>()
  for (const s of shops) byCode.set(s.code, s)
  return { byCode, codes: shops.map((s) => s.code) }
}

// ── findShopCodes ────────────────────────────────────────────────────────────

describe('findShopCodes', () => {
  const codes = ['CAPE99', 'JHB1234', 'DBN0001']

  it('finds an exact code', () => {
    expect(findShopCodes('CAPE99', codes)).toEqual(['CAPE99'])
  })

  it('finds a code embedded in extra text and normalizes case/spacing', () => {
    expect(findShopCodes('eft payment cape 99 thanks', codes)).toEqual(['CAPE99'])
    expect(findShopCodes('ref: jhb-1234', codes)).toEqual(['JHB1234'])
  })

  it('returns empty when no code present', () => {
    expect(findShopCodes('rent payment', codes)).toEqual([])
    expect(findShopCodes('', codes)).toEqual([])
  })

  it('returns multiple when two distinct codes appear (ambiguous)', () => {
    const r = findShopCodes('CAPE99 and DBN0001', codes)
    expect(r).toHaveLength(2)
    expect(r).toContain('CAPE99')
    expect(r).toContain('DBN0001')
  })
})

// ── monthsFromAmount ─────────────────────────────────────────────────────────

describe('monthsFromAmount', () => {
  it('exact price = 1 month', () => {
    expect(monthsFromAmount(349.99, PRICE)).toBe(1)
  })
  it('exact 2x = 2 months', () => {
    expect(monthsFromAmount(699.98, PRICE)).toBe(2)
  })
  it('exact 3x = 3 months', () => {
    expect(monthsFromAmount(1049.97, PRICE)).toBe(3)
  })
  it('non-multiple returns null (underpayment)', () => {
    expect(monthsFromAmount(300, PRICE)).toBeNull()
  })
  it('near-but-not-exact (R700) returns null', () => {
    expect(monthsFromAmount(700, PRICE)).toBeNull()
  })
  it('zero / negative returns null', () => {
    expect(monthsFromAmount(0, PRICE)).toBeNull()
    expect(monthsFromAmount(-349.99, PRICE)).toBeNull()
  })
})

// ── computeRenewalEnd (the core renewal-aware rule) ──────────────────────────

describe('computeRenewalEnd', () => {
  it('lapsed/expired shop starts from today (reactivation day)', () => {
    const end = computeRenewalEnd(
      { subscription_status: 'expired', subscription_ends_at: '2026-01-01T00:00:00Z', trial_ends_at: null },
      1,
      NOW,
    )
    // 30 days from NOW
    expect(end.getTime()).toBe(NOW.getTime() + 30 * 24 * 60 * 60 * 1000)
  })

  it('active shop paying early STACKS onto its existing end date', () => {
    const futureEnd = '2026-06-20T00:00:00Z'
    const end = computeRenewalEnd(
      { subscription_status: 'active', subscription_ends_at: futureEnd, trial_ends_at: null },
      1,
      NOW,
    )
    expect(end.getTime()).toBe(new Date(futureEnd).getTime() + 30 * 24 * 60 * 60 * 1000)
  })

  it('manual_override with future end also stacks', () => {
    const futureEnd = '2026-07-01T00:00:00Z'
    const end = computeRenewalEnd(
      { subscription_status: 'manual_override', subscription_ends_at: futureEnd, trial_ends_at: null },
      2,
      NOW,
    )
    expect(end.getTime()).toBe(new Date(futureEnd).getTime() + 60 * 24 * 60 * 60 * 1000)
  })

  it('trialing shop with a future trial end stacks onto the trial', () => {
    const trialEnd = '2026-06-05T00:00:00Z'
    const end = computeRenewalEnd(
      { subscription_status: 'trialing', subscription_ends_at: null, trial_ends_at: trialEnd },
      1,
      NOW,
    )
    expect(end.getTime()).toBe(new Date(trialEnd).getTime() + 30 * 24 * 60 * 60 * 1000)
  })

  it('processing_cancellation (in grace) with a future deadline stacks onto it', () => {
    // Phase 54 — a shop paying during its 4-day grace renews from the grace
    // deadline, not from today.
    const graceEnd = '2026-06-03T00:00:00Z'
    const end = computeRenewalEnd(
      { subscription_status: 'processing_cancellation', subscription_ends_at: graceEnd, trial_ends_at: null },
      1,
      NOW,
    )
    expect(end.getTime()).toBe(new Date(graceEnd).getTime() + 30 * 24 * 60 * 60 * 1000)
  })

  it('cancelled but past end date starts from today', () => {
    const end = computeRenewalEnd(
      { subscription_status: 'cancelled', subscription_ends_at: '2026-01-01T00:00:00Z', trial_ends_at: null },
      1,
      NOW,
    )
    expect(end.getTime()).toBe(NOW.getTime() + 30 * 24 * 60 * 60 * 1000)
  })

  it('multiple months extends proportionally (30 days each)', () => {
    const end = computeRenewalEnd(
      { subscription_status: 'expired', subscription_ends_at: null, trial_ends_at: null },
      3,
      NOW,
    )
    expect(end.getTime()).toBe(NOW.getTime() + 90 * 24 * 60 * 60 * 1000)
  })
})

// ── dedupeKey ────────────────────────────────────────────────────────────────

describe('dedupeKey', () => {
  it('is stable across reference formatting differences', () => {
    const a = dedupeKey(deposit({ reference: 'CAPE99' }))
    const b = dedupeKey(deposit({ reference: 'cape 99' }))
    expect(a).toBe(b)
  })
  it('differs by amount and date', () => {
    expect(dedupeKey(deposit({ amount: 349.99 }))).not.toBe(dedupeKey(deposit({ amount: 699.98 })))
    expect(dedupeKey(deposit({ date: '2026-05-20' }))).not.toBe(dedupeKey(deposit({ date: '2026-05-21' })))
  })
})

// ── classifyDeposit ──────────────────────────────────────────────────────────

describe('classifyDeposit', () => {
  const { byCode, codes } = roster([shop()])

  it('confident match → applied', () => {
    const c = classifyDeposit(deposit(), byCode, codes, PRICE, new Set())
    expect(c.outcome).toBe('applied')
    expect(c.shopId).toBe('shop-1')
    expect(c.months).toBe(1)
  })

  it('already-applied dedupe key → duplicate', () => {
    const d = deposit()
    const applied = new Set([dedupeKey(d)])
    expect(classifyDeposit(d, byCode, codes, PRICE, applied).outcome).toBe('duplicate')
  })

  it('no code → unmatched', () => {
    const c = classifyDeposit(deposit({ reference: 'rent' }), byCode, codes, PRICE, new Set())
    expect(c.outcome).toBe('unmatched')
  })

  it('two codes → needs_review (ambiguous)', () => {
    const two = roster([shop(), shop({ id: 'shop-2', code: 'DBN0001', name: 'Dbn' })])
    const c = classifyDeposit(
      deposit({ reference: 'CAPE99 DBN0001' }),
      two.byCode,
      two.codes,
      PRICE,
      new Set(),
    )
    expect(c.outcome).toBe('needs_review')
  })

  it('matched code but non-multiple amount → needs_review with candidate', () => {
    const c = classifyDeposit(deposit({ amount: 300 }), byCode, codes, PRICE, new Set())
    expect(c.outcome).toBe('needs_review')
    expect(c.matchedCode).toBe('CAPE99')
    expect(c.shopId).toBe('shop-1')
  })
})

// ── OFX adapter ──────────────────────────────────────────────────────────────

describe('parseOfx', () => {
  const ofx = `
OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260520120000<TRNAMT>349.99<FITID>abc1<NAME>EFT CAPE99<MEMO>subscription</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260521<TRNAMT>-50.00<FITID>abc2<NAME>bank fee</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260522<TRNAMT>699.98<NAME>JHB1234 two months</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

  it('parses credits only, maps named fields, drops debits', () => {
    const { deposits } = parseOfx(ofx)
    expect(deposits).toHaveLength(2)
    expect(deposits[0]).toMatchObject({ date: '2026-05-20', amount: 349.99 })
    expect(deposits[0].reference).toContain('CAPE99')
    expect(deposits[1]).toMatchObject({ date: '2026-05-22', amount: 699.98 })
  })

  it('reports no-transaction files', () => {
    const { deposits, errors } = parseOfx('<OFX></OFX>')
    expect(deposits).toHaveLength(0)
    expect(errors.length).toBeGreaterThan(0)
  })
})

// ── CSV adapter: field parsing ───────────────────────────────────────────────

describe('parseDate', () => {
  it('ISO', () => expect(parseDate('2026-05-20', NOW)).toBe('2026-05-20'))
  it('SA DD/MM/YYYY', () => expect(parseDate('20/05/2026', NOW)).toBe('2026-05-20'))
  it('DD MMM YYYY', () => expect(parseDate('20 May 2026', NOW)).toBe('2026-05-20'))
  it('Afrikaans month abbreviations', () => {
    expect(parseDate('03 Mrt 2026', NOW)).toBe('2026-03-03')
    expect(parseDate('15 Des 2025', NOW)).toBe('2025-12-15')
    expect(parseDate('01 Okt 2026', NOW)).toBe('2026-10-01')
  })
  it('year-less date infers current year', () => {
    expect(parseDate('20 May', NOW)).toBe('2026-05-20')
  })
  it('year-less Dec when now is mid-year infers previous year (boundary span)', () => {
    // NOW is May 2026; a "29 Dec" entry must be 2025, not a future 2026.
    expect(parseDate('29 Dec', NOW)).toBe('2025-12-29')
  })
  it('rejects junk', () => expect(parseDate('not a date', NOW)).toBeNull())
})

describe('parseAmount', () => {
  it('plain', () => expect(parseAmount('349.99')).toBe(349.99))
  it('with R and thousands comma', () => expect(parseAmount('R1,349.99')).toBe(1349.99))
  it('negative (debit)', () => expect(parseAmount('-50.00')).toBe(-50))
  it('parenthesised negative', () => expect(parseAmount('(50.00)')).toBe(-50))
  it('blank → null', () => expect(parseAmount('')).toBeNull())
})

// ── CSV adapter: column detection + parse ────────────────────────────────────

describe('parseCsv', () => {
  const headerCsv = `Date,Description,Amount,Balance
2026-05-20,EFT CAPE99 subscription,349.99,1000.00
2026-05-21,Bank fee,-50.00,950.00
2026-05-22,JHB1234 two months,699.98,1649.98`

  it('detects columns by header + content and keeps credits only', () => {
    const res = parseCsv(headerCsv, { now: NOW })
    expect(res.mapping).toEqual({ date: 0, amount: 2, reference: 1 })
    expect(res.deposits).toHaveLength(2) // debit dropped
    expect(res.deposits[0]).toMatchObject({ date: '2026-05-20', amount: 349.99 })
    expect(res.deposits[0].reference).toContain('CAPE99')
  })

  it('resilient to reordered/renamed columns (content detection)', () => {
    const reordered = `Txn Amount,Narrative,Posting Date
349.99,CAPE99 pay,2026-05-20
699.98,JHB1234,2026-05-22`
    const res = parseCsv(reordered, { now: NOW })
    expect(res.deposits).toHaveLength(2)
    expect(res.deposits[0].amount).toBe(349.99)
    expect(res.deposits[0].date).toBe('2026-05-20')
    expect(res.deposits[0].reference).toContain('CAPE99')
  })

  it('skips metadata/summary rows that do not parse as a dated credit', () => {
    const messy = `Account Statement,12345678,,
Opening Balance,,1000.00,
Date,Description,Amount,Balance
2026-05-20,CAPE99,349.99,1349.99
Closing Balance,,1349.99,`
    const res = parseCsv(messy, { now: NOW })
    expect(res.deposits).toHaveLength(1)
    expect(res.deposits[0].amount).toBe(349.99)
  })

  it('honours an explicit mapping (skips detection)', () => {
    const res = parseCsv(headerCsv, { now: NOW, mapping: { date: 0, amount: 2, reference: 1 } })
    expect(res.deposits).toHaveLength(2)
  })

  it('reports when no usable columns are found', () => {
    const res = parseCsv('just,some,text\nmore,random,words', { now: NOW })
    expect(res.deposits).toHaveLength(0)
  })
})

describe('detectColumns + parseRows', () => {
  it('parses quoted fields containing commas', () => {
    const rows = parseRows('a,"hello, world",c')
    expect(rows[0]).toEqual(['a', 'hello, world', 'c'])
  })
})

// ── normalizeRef ─────────────────────────────────────────────────────────────

describe('normalizeRef', () => {
  it('uppercases and strips non-alphanumerics', () => {
    expect(normalizeRef('cape-99 ref!')).toBe('CAPE99REF')
  })
})
