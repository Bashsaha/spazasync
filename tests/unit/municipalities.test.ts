import { describe, it, expect } from 'vitest'
import { filterRequirementsByNationality } from '@/lib/db/municipalities'
import {
  documentRequirementSchema,
  municipalitySchema,
  municipalityOfficeSchema,
  municipalityRequirementSchema,
  PROVINCES,
  OFFICE_TYPES,
  REQUIREMENT_TYPES,
  NATIONALITY_TYPES,
  DOCUMENT_APPLIES_TO,
} from '@/lib/validation/schemas'
import type { DocumentRequirement } from '@/types'

const SAMPLE_DOCS: DocumentRequirement[] = [
  { name: 'SA ID', applies_to: 'sa_citizen', required: true },
  { name: 'Passport with visa', applies_to: 'foreign_national', required: true },
  { name: 'Proof of residence', applies_to: 'all', required: true },
  { name: 'CIPC certificate', applies_to: 'all', required: false, notes: 'Optional but recommended' },
  { name: 'Asylum permit', applies_to: 'foreign_national', required: false },
]

describe('filterRequirementsByNationality', () => {
  it('SA citizen sees sa_citizen + all docs (no foreign-only)', () => {
    const result = filterRequirementsByNationality(SAMPLE_DOCS, 'sa_citizen')
    const names = result.map((d) => d.name)
    expect(names).toContain('SA ID')
    expect(names).toContain('Proof of residence')
    expect(names).toContain('CIPC certificate')
    expect(names).not.toContain('Passport with visa')
    expect(names).not.toContain('Asylum permit')
    expect(result).toHaveLength(3)
  })

  it('foreign national sees foreign_national + all docs (no SA-only)', () => {
    const result = filterRequirementsByNationality(SAMPLE_DOCS, 'foreign_national')
    const names = result.map((d) => d.name)
    expect(names).toContain('Passport with visa')
    expect(names).toContain('Asylum permit')
    expect(names).toContain('Proof of residence')
    expect(names).toContain('CIPC certificate')
    expect(names).not.toContain('SA ID')
    expect(result).toHaveLength(4)
  })

  it('returns empty array when input is empty', () => {
    expect(filterRequirementsByNationality([], 'sa_citizen')).toEqual([])
  })

  it('preserves required + notes fields on filtered docs', () => {
    const result = filterRequirementsByNationality(SAMPLE_DOCS, 'sa_citizen')
    const cipc = result.find((d) => d.name === 'CIPC certificate')
    expect(cipc?.required).toBe(false)
    expect(cipc?.notes).toBe('Optional but recommended')
  })
})

describe('schema enums', () => {
  it('PROVINCES contains all 9 SA provinces', () => {
    expect(PROVINCES).toHaveLength(9)
    expect(PROVINCES).toContain('gauteng')
    expect(PROVINCES).toContain('western_cape')
    expect(PROVINCES).toContain('kzn')
  })

  it('OFFICE_TYPES has the 4 expected values', () => {
    expect(OFFICE_TYPES).toHaveLength(4)
    expect(OFFICE_TYPES).toContain('trading_permit')
    expect(OFFICE_TYPES).toContain('environmental_health')
  })

  it('REQUIREMENT_TYPES has the 3 expected values', () => {
    expect(REQUIREMENT_TYPES).toEqual(['trading_permit', 'coa', 'general'])
  })

  it('NATIONALITY_TYPES has sa_citizen + foreign_national', () => {
    expect(NATIONALITY_TYPES).toEqual(['sa_citizen', 'foreign_national'])
  })

  it('DOCUMENT_APPLIES_TO includes "all"', () => {
    expect(DOCUMENT_APPLIES_TO).toContain('all')
  })
})

describe('documentRequirementSchema', () => {
  it('accepts a valid SA-citizen doc', () => {
    const r = documentRequirementSchema.safeParse({
      name: 'SA ID',
      applies_to: 'sa_citizen',
      required: true,
    })
    expect(r.success).toBe(true)
  })

  it('accepts notes', () => {
    const r = documentRequirementSchema.safeParse({
      name: 'CIPC',
      applies_to: 'all',
      required: false,
      notes: 'See step 3',
    })
    expect(r.success).toBe(true)
  })

  it('rejects unknown applies_to', () => {
    const r = documentRequirementSchema.safeParse({
      name: 'X',
      applies_to: 'martian',
      required: true,
    })
    expect(r.success).toBe(false)
  })

  it('rejects empty name', () => {
    const r = documentRequirementSchema.safeParse({
      name: '',
      applies_to: 'all',
      required: true,
    })
    expect(r.success).toBe(false)
  })
})

describe('municipalitySchema', () => {
  it('accepts a valid municipality', () => {
    const r = municipalitySchema.safeParse({
      name: 'City of Johannesburg',
      province: 'gauteng',
      short_name: 'Johannesburg',
      areas: ['Soweto', 'Sandton'],
    })
    expect(r.success).toBe(true)
  })

  it('defaults areas to empty array', () => {
    const r = municipalitySchema.safeParse({
      name: 'City of X',
      province: 'gauteng',
      short_name: 'X',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.areas).toEqual([])
  })

  it('rejects unknown province', () => {
    const r = municipalitySchema.safeParse({
      name: 'X',
      province: 'atlantis',
      short_name: 'X',
      areas: [],
    })
    expect(r.success).toBe(false)
  })
})

describe('municipalityOfficeSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts a minimal valid office', () => {
    const r = municipalityOfficeSchema.safeParse({
      municipality_id: validId,
      office_type: 'trading_permit',
      name: 'Town Planning Help Desk',
      address: '33 Hoofd Street',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an invalid office_type', () => {
    const r = municipalityOfficeSchema.safeParse({
      municipality_id: validId,
      office_type: 'bakery',
      name: 'X',
      address: 'Y',
    })
    expect(r.success).toBe(false)
  })

  it('rejects a malformed email', () => {
    const r = municipalityOfficeSchema.safeParse({
      municipality_id: validId,
      office_type: 'trading_permit',
      name: 'X',
      address: 'Y',
      email: 'not-an-email',
    })
    expect(r.success).toBe(false)
  })

  it('treats empty-string url as null', () => {
    const r = municipalityOfficeSchema.safeParse({
      municipality_id: validId,
      office_type: 'trading_permit',
      name: 'X',
      address: 'Y',
      online_form_url: '',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.online_form_url).toBeNull()
  })
})

describe('municipalityRequirementSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts a valid requirement with nested docs', () => {
    const r = municipalityRequirementSchema.safeParse({
      municipality_id: validId,
      requirement_type: 'trading_permit',
      documents_required: [
        { name: 'SA ID', applies_to: 'sa_citizen', required: true },
      ],
      fees: 'R200-R500',
      estimated_processing_time: '1-4 weeks',
    })
    expect(r.success).toBe(true)
  })

  it('defaults documents_required to empty array', () => {
    const r = municipalityRequirementSchema.safeParse({
      municipality_id: validId,
      requirement_type: 'general',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.documents_required).toEqual([])
  })

  it('rejects an invalid nested doc', () => {
    const r = municipalityRequirementSchema.safeParse({
      municipality_id: validId,
      requirement_type: 'trading_permit',
      documents_required: [
        { name: '', applies_to: 'all', required: true },
      ],
    })
    expect(r.success).toBe(false)
  })
})
