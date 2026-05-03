import { describe, it, expect } from 'vitest'
import {
  computeDocumentStatus,
  EXPIRY_WARNING_DAYS,
  OWNER_ID_WARNING_DAYS,
} from '@/lib/compliance/document-status'
import type { BusinessDocument, DocumentType, DocumentStatus } from '@/types'

const TODAY = '2026-04-21'

function ymdPlus(daysFromToday: number): string {
  const d = new Date(`${TODAY}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + daysFromToday)
  return d.toISOString().slice(0, 10)
}

function doc(
  document_type: DocumentType,
  status: DocumentStatus,
  expiry_date: string | null = null,
): BusinessDocument {
  return {
    id: `${document_type}-id`,
    shop_id: 'shop',
    document_type,
    status,
    reference_number: null,
    date_issued: null,
    expiry_date,
    notes: null,
    applied_at: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
  }
}

describe('computeDocumentStatus', () => {
  it('empty list → grey, all 5 missing', () => {
    const r = computeDocumentStatus([], TODAY)
    expect(r.overall).toBe('grey')
    expect(r.totalLogged).toBe(0)
    expect(r.validCount).toBe(0)
    expect(r.missing).toHaveLength(5)
    expect(r.expiringSoon).toEqual([])
    expect(r.expired).toEqual([])
  })

  it('all 5 valid with expiries far away → green', () => {
    const docs: BusinessDocument[] = [
      doc('municipal_registration', 'valid'),
      doc('coa', 'valid', ymdPlus(120)),
      doc('cipc', 'valid'),
      doc('business_license', 'valid', ymdPlus(180)),
      doc('owner_id', 'on_file'),
    ]
    const r = computeDocumentStatus(docs, TODAY)
    expect(r.overall).toBe('green')
    expect(r.missing).toEqual([])
    expect(r.expiringSoon).toEqual([])
    expect(r.expired).toEqual([])
    expect(r.validCount).toBe(5)
  })

  it('coa expiring in 25 days → amber', () => {
    const docs: BusinessDocument[] = [
      doc('municipal_registration', 'valid'),
      doc('coa', 'valid', ymdPlus(25)),
      doc('cipc', 'valid'),
      doc('business_license', 'valid', ymdPlus(200)),
      doc('owner_id', 'on_file'),
    ]
    const r = computeDocumentStatus(docs, TODAY)
    expect(r.overall).toBe('amber')
    expect(r.expiringSoon).toHaveLength(1)
    expect(r.expiringSoon[0].document_type).toBe('coa')
    expect(r.expiringSoon[0].days_remaining).toBe(25)
    expect(r.expired).toEqual([])
  })

  it('business_license expired 5 days ago → red', () => {
    const docs: BusinessDocument[] = [
      doc('municipal_registration', 'valid'),
      doc('coa', 'valid', ymdPlus(60)),
      doc('cipc', 'valid'),
      doc('business_license', 'valid', ymdPlus(-5)),
      doc('owner_id', 'on_file'),
    ]
    const r = computeDocumentStatus(docs, TODAY)
    expect(r.overall).toBe('red')
    expect(r.expired).toHaveLength(1)
    expect(r.expired[0].document_type).toBe('business_license')
    expect(r.expired[0].days_remaining).toBe(-5)
  })

  it('explicit status=expired (no expiry_date) → red', () => {
    const docs: BusinessDocument[] = [
      doc('coa', 'expired', null),
    ]
    const r = computeDocumentStatus(docs, TODAY)
    expect(r.overall).toBe('red')
    expect(r.expired).toHaveLength(1)
  })

  it('owner_id permit expiring in 45 days (foreign) → amber (60-day window)', () => {
    const docs: BusinessDocument[] = [
      doc('municipal_registration', 'valid'),
      doc('coa', 'valid', ymdPlus(120)),
      doc('cipc', 'valid'),
      doc('business_license', 'valid', ymdPlus(180)),
      doc('owner_id', 'valid', ymdPlus(45)),
    ]
    const r = computeDocumentStatus(docs, TODAY)
    expect(r.overall).toBe('amber')
    expect(r.expiringSoon).toHaveLength(1)
    expect(r.expiringSoon[0].document_type).toBe('owner_id')
  })

  it('non-permit doc expiring in 45 days → still green (outside 30-day window)', () => {
    const docs: BusinessDocument[] = [
      doc('municipal_registration', 'valid'),
      doc('coa', 'valid', ymdPlus(45)),
      doc('cipc', 'valid'),
      doc('business_license', 'valid', ymdPlus(180)),
      doc('owner_id', 'on_file'),
    ]
    const r = computeDocumentStatus(docs, TODAY)
    expect(r.overall).toBe('green')
    expect(r.expiringSoon).toEqual([])
  })

  it('owner_id permit + CoA both close to expiry → amber, both surfaced', () => {
    const docs: BusinessDocument[] = [
      doc('municipal_registration', 'valid'),
      doc('coa', 'valid', ymdPlus(25)),
      doc('cipc', 'valid'),
      doc('business_license', 'valid', ymdPlus(200)),
      doc('owner_id', 'valid', ymdPlus(45)),
    ]
    const r = computeDocumentStatus(docs, TODAY)
    expect(r.overall).toBe('amber')
    expect(r.expiringSoon).toHaveLength(2)
  })

  it('SA citizen on_file + everything else valid → green', () => {
    const docs: BusinessDocument[] = [
      doc('municipal_registration', 'valid'),
      doc('coa', 'valid', ymdPlus(100)),
      doc('cipc', 'valid'),
      doc('business_license', 'valid', ymdPlus(400)),
      doc('owner_id', 'on_file', null),
    ]
    const r = computeDocumentStatus(docs, TODAY)
    expect(r.overall).toBe('green')
  })

  it('mixed expired + expiring → red wins', () => {
    const docs: BusinessDocument[] = [
      doc('municipal_registration', 'valid'),
      doc('coa', 'valid', ymdPlus(-2)),
      doc('cipc', 'valid'),
      doc('business_license', 'valid', ymdPlus(20)),
      doc('owner_id', 'on_file'),
    ]
    const r = computeDocumentStatus(docs, TODAY)
    expect(r.overall).toBe('red')
    expect(r.expired).toHaveLength(1)
    expect(r.expiringSoon).toHaveLength(1)
  })

  it('pending status → amber', () => {
    const docs: BusinessDocument[] = [
      doc('municipal_registration', 'pending'),
      doc('coa', 'valid', ymdPlus(100)),
      doc('cipc', 'valid'),
      doc('business_license', 'valid', ymdPlus(180)),
      doc('owner_id', 'on_file'),
    ]
    const r = computeDocumentStatus(docs, TODAY)
    expect(r.overall).toBe('amber')
  })

  it('not_registered status → amber', () => {
    const docs: BusinessDocument[] = [
      doc('municipal_registration', 'valid'),
      doc('coa', 'valid', ymdPlus(100)),
      doc('cipc', 'not_registered'),
      doc('business_license', 'valid', ymdPlus(180)),
      doc('owner_id', 'on_file'),
    ]
    const r = computeDocumentStatus(docs, TODAY)
    expect(r.overall).toBe('amber')
  })

  it('partial logging (some types missing) → amber', () => {
    const docs: BusinessDocument[] = [
      doc('municipal_registration', 'valid'),
      doc('coa', 'valid', ymdPlus(100)),
    ]
    const r = computeDocumentStatus(docs, TODAY)
    expect(r.overall).toBe('amber')
    expect(r.missing).toHaveLength(3)
  })

  it('expiry exactly at 30-day boundary triggers amber', () => {
    const docs: BusinessDocument[] = [
      doc('municipal_registration', 'valid'),
      doc('coa', 'valid', ymdPlus(EXPIRY_WARNING_DAYS)),
      doc('cipc', 'valid'),
      doc('business_license', 'valid', ymdPlus(180)),
      doc('owner_id', 'on_file'),
    ]
    const r = computeDocumentStatus(docs, TODAY)
    expect(r.overall).toBe('amber')
    expect(r.expiringSoon).toHaveLength(1)
  })

  it('owner_id permit at 60-day boundary triggers amber', () => {
    const docs: BusinessDocument[] = [
      doc('municipal_registration', 'valid'),
      doc('coa', 'valid', ymdPlus(120)),
      doc('cipc', 'valid'),
      doc('business_license', 'valid', ymdPlus(180)),
      doc('owner_id', 'valid', ymdPlus(OWNER_ID_WARNING_DAYS)),
    ]
    const r = computeDocumentStatus(docs, TODAY)
    expect(r.overall).toBe('amber')
    expect(r.expiringSoon[0].document_type).toBe('owner_id')
  })
})
