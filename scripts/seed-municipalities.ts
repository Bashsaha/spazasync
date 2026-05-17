/**
 * Seed the municipality directory (Phase 37a).
 *
 * Usage: npx tsx scripts/seed-municipalities.ts
 *
 * Idempotent — re-running is safe. Upserts municipalities by (name, province),
 * then for each one wipes its offices + requirements and re-inserts the
 * current canonical set. This means the spec doc is always the source of
 * truth — never edit rows directly in Supabase.
 *
 * Data sources are restricted per CLAUDE.md design rule 7 (government-verified
 * sites only): joburg.org.za, tshwane.gov.za, ekurhuleni.gov.za, durban.gov.za,
 * capetown.gov.za, mangaung.co.za, gov.za, westerncape.gov.za.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type AppliesTo = 'sa_citizen' | 'foreign_national' | 'all'
type Province =
  | 'gauteng' | 'western_cape' | 'kzn' | 'eastern_cape'
  | 'free_state' | 'limpopo' | 'mpumalanga' | 'north_west' | 'northern_cape'
type OfficeType = 'trading_permit' | 'environmental_health' | 'business_licensing' | 'customer_care'
type RequirementType = 'trading_permit' | 'coa' | 'general'

interface SeedDoc {
  name: string
  applies_to: AppliesTo
  required: boolean
  notes?: string | null
}

interface SeedOffice {
  office_type: OfficeType
  name: string
  address: string
  area?: string | null
  phone?: string | null
  email?: string | null
  hours?: string | null
  online_portal_url?: string | null
  online_form_url?: string | null
  notes?: string | null
}

interface SeedRequirement {
  requirement_type: RequirementType
  documents_required: SeedDoc[]
  fees?: string | null
  estimated_processing_time?: string | null
  additional_notes?: string | null
}

interface SeedMunicipality {
  name: string
  province: Province
  short_name: string
  areas: string[]
  offices: SeedOffice[]
  requirements: SeedRequirement[]
}

const STD_HOURS = 'Mon-Fri 08:00-16:30'

const MUNICIPALITIES: SeedMunicipality[] = [
  {
    name: 'City of Johannesburg',
    province: 'gauteng',
    short_name: 'Johannesburg',
    areas: [
      'Soweto', 'Alexandra', 'Sandton', 'Jabulani', 'Roodepoort', 'Randburg',
      'Diepsloot', 'Orange Farm', 'Lenasia', 'Eldorado Park', 'Ennerdale',
      'Braamfontein', 'Hillbrow', 'Yeoville', 'Berea',
    ],
    offices: [
      {
        office_type: 'trading_permit',
        name: 'Town Planning Help Desk',
        address: 'Forum 1, Block B, Braampark Office Park, 33 Hoofd Street, Braamfontein',
        area: 'Braamfontein',
        email: 'LandUseApplications@joburg.org.za',
        hours: STD_HOURS,
        online_form_url: 'https://joburg.org.za/departments_/Documents/Development%20Planning/Form%2013%20Spaza%20House%20Shop.pdf',
        notes: 'Use Form 13 — Spaza / House Shop. Application circulated to Town Planning, Environmental Health, Fire, Building Control, and CGIS for comment.',
      },
      {
        office_type: 'trading_permit',
        name: 'Jabulani Regional Office',
        address: 'Jabulani Civic Centre, No. 1 Koma Road, Jabulani',
        area: 'Jabulani',
        hours: STD_HOURS,
      },
      {
        office_type: 'trading_permit',
        name: 'CGIS Public Info Counter',
        address: '66 Stiemens Street, Braamfontein, Ground Floor',
        area: 'Braamfontein',
        hours: STD_HOURS,
      },
    ],
    requirements: [
      {
        requirement_type: 'trading_permit',
        fees: 'R300 for a 3-year permit (Informal Trader Permit). Source: joburg.org.za (verify current tariff annually)',
        estimated_processing_time: '4-8 weeks (includes department circulation and possible advertising period)',
        documents_required: [
          { name: 'Certified copy of SA ID (not older than 3 months)', applies_to: 'sa_citizen', required: true },
          { name: 'Certified copy of passport with valid business visa', applies_to: 'foreign_national', required: true, notes: 'OR Section 22 asylum seeker permit, OR Section 24 refugee permit' },
          { name: 'Proof of residence', applies_to: 'all', required: true, notes: 'Municipal bill, rental agreement, or affidavit from landlord' },
          { name: 'Business banking account details', applies_to: 'all', required: true, notes: 'Stamped statement from your bank' },
          { name: 'CIPC registration certificate', applies_to: 'all', required: true },
          { name: 'Proof of ownership or permission to use premises', applies_to: 'all', required: true, notes: 'Title deed, lease agreement, or landlord affidavit with certified ID of stand owner' },
          { name: 'Zoning certificate / consent use / special consent', applies_to: 'all', required: true, notes: 'From municipal city planning department' },
          { name: 'Certificate of Acceptability or comment from Environmental Health', applies_to: 'all', required: true, notes: 'Can apply simultaneously — see Step 2 in your compliance journey' },
          { name: 'Internal floor layout plan', applies_to: 'all', required: true, notes: 'Can be hand-drawn. Must show shop layout' },
          { name: 'Affidavit: not engaged in trade of illegal goods', applies_to: 'all', required: true, notes: 'Get stamped at nearest police station (free)' },
          { name: 'Tax clearance certificate from SARS', applies_to: 'all', required: true, notes: 'Apply via SARS eFiling — see Step 4 in your compliance journey' },
        ],
      },
    ],
  },

  {
    name: 'City of Tshwane',
    province: 'gauteng',
    short_name: 'Tshwane',
    areas: [
      'Pretoria CBD', 'Mamelodi', 'Atteridgeville', 'Soshanguve', 'Ga-Rankuwa',
      'Hammanskraal', 'Centurion', 'Pretoria West', 'Pretoria North',
      'Winterveld', 'Temba', 'Mabopane',
    ],
    offices: [
      {
        office_type: 'business_licensing',
        name: 'Business Licensing Section',
        address: 'Middestad Building, Pretoria CBD',
        area: 'Pretoria CBD',
        hours: STD_HOURS,
        online_portal_url: 'https://opendata.tshwane.gov.za/Spazaregister/app-registration',
        notes: 'Online registration available. As of Feb 2025, 4,222 applications received, only 192 met criteria.',
      },
    ],
    requirements: [
      {
        requirement_type: 'trading_permit',
        documents_required: [
          { name: 'Certified copy of SA ID', applies_to: 'sa_citizen', required: true },
          { name: 'Home Affairs documents for foreigners (certified copies)', applies_to: 'foreign_national', required: true, notes: 'Foreign nationals need proof of R5 million capital investment + business visa (Immigration Act Regulations 2014, Reg 15)' },
          { name: 'Affidavit and certified ID of stand/erf owner', applies_to: 'all', required: true, notes: 'Required if property is zoned as Residential 5' },
          { name: 'Proof of ownership or permission to use premises', applies_to: 'all', required: true, notes: 'If City-owned property: Special Power of Attorney from City Manager through Group Property (Ou Raadsaal or Tshwane House)' },
        ],
      },
    ],
  },

  {
    name: 'City of Ekurhuleni',
    province: 'gauteng',
    short_name: 'Ekurhuleni',
    areas: [
      'Germiston', 'Benoni', 'Boksburg', 'Springs', 'Brakpan', 'Alberton',
      'Edenvale', 'Kempton Park', 'Tembisa', 'Katlehong', 'Thokoza',
      'Vosloorus', 'Daveyton', 'KwaThema', 'Tsakane', 'Duduza',
    ],
    offices: [
      {
        office_type: 'customer_care',
        name: 'Nearest Customer Care Centre',
        address: 'Various locations across the city',
        hours: STD_HOURS,
        notes: 'Registration at nearest customer care centre. Digitised application process available. As of Dec 2024, 85 registration centres established across all 5 regions.',
      },
    ],
    requirements: [
      {
        requirement_type: 'trading_permit',
        documents_required: [
          { name: 'Certified copy of SA ID', applies_to: 'sa_citizen', required: true },
          { name: 'Passport with valid business visa', applies_to: 'foreign_national', required: true },
          { name: 'Tax clearance certificate from SARS', applies_to: 'all', required: true },
          { name: 'CIPC registration', applies_to: 'all', required: true },
          { name: 'Certificate of Acceptability', applies_to: 'all', required: true },
          { name: 'Proof of premises ownership or permission', applies_to: 'all', required: true },
        ],
      },
    ],
  },

  {
    name: 'eThekwini Municipality',
    province: 'kzn',
    short_name: 'eThekwini',
    areas: [
      'Durban CBD', 'Umlazi', 'KwaMashu', 'Ntuzuma', 'Inanda', 'Chatsworth',
      'Phoenix', 'Pinetown', 'Clermont', 'Verulam', 'Tongaat', 'Winklespruit',
      'Umbumbulu',
    ],
    offices: [
      {
        office_type: 'business_licensing',
        name: 'Embassy Building',
        address: '7th Floor, 199 Anton Lembede Street, Durban CBD',
        area: 'Durban CBD',
        phone: '031 311 4535',
        email: 'businesslicensing@ethekwini.gov.za',
        hours: STD_HOURS,
      },
      {
        office_type: 'business_licensing',
        name: 'Sizakala Centre Winklespruit',
        address: '9 Mayors Mews, Winklespruit',
        area: 'Winklespruit',
        phone: '031 311 5870',
        hours: STD_HOURS,
      },
      {
        office_type: 'business_licensing',
        name: 'Sizakala Centre Pinetown',
        address: 'Pinetown Civic Centre, 60 Kings Road, Pinetown',
        area: 'Pinetown',
        phone: '031 311 6209',
        hours: STD_HOURS,
      },
      {
        office_type: 'business_licensing',
        name: 'Sizakala Centre Verulam',
        address: 'Ground Floor, 151 Wick Street, Verulam',
        area: 'Verulam',
        phone: '031 322 1803',
        hours: STD_HOURS,
      },
      // Phase 41b — Environmental Health office surfaces the official R638
      // CoA application PDF via online_form_url so OfficialFormCallout +
      // OfficeDirections can render a direct download link.
      {
        office_type: 'environmental_health',
        name: 'eThekwini Environmental Health (CoA applications)',
        address: '7th Floor, Embassy Building, 199 Anton Lembede Street, Durban CBD',
        area: 'Durban CBD',
        phone: '031 311 4535',
        email: 'businesslicensing@ethekwini.gov.za',
        hours: STD_HOURS,
        online_form_url: 'https://www.durban.gov.za/uploads/0000/6/2025/09/21/certificate-of-acceptability-for-food-premises.pdf',
      },
    ],
    requirements: [
      {
        requirement_type: 'trading_permit',
        fees: 'Annual renewal: free. Source: durban.gov.za (verify current tariff annually)',
        estimated_processing_time: '~21 days',
        additional_notes: '6,110 applications submitted by Feb 2025 deadline, ~1,562 licences approved. Inspections by multidisciplinary team: Metro Police, SAPS, Fire & Emergency, Business Licensing.',
        documents_required: [
          { name: 'Certified copy of SA ID', applies_to: 'sa_citizen', required: true },
          { name: 'Passport with valid visa or permit', applies_to: 'foreign_national', required: true, notes: 'Section 22 asylum seeker or Section 24 refugee permit accepted' },
          { name: 'Proof of premises (lease, title deed, or landlord affidavit)', applies_to: 'all', required: true },
          { name: 'Certificate of Acceptability', applies_to: 'all', required: true },
        ],
      },
      {
        requirement_type: 'coa',
        additional_notes: 'Certificate of Acceptability application. Contact Business Licensing (031 311 4535) or visit nearest Sizakala Centre.',
        documents_required: [
          { name: 'Certificate of Acceptability application form', applies_to: 'all', required: true, notes: 'Download: https://www.durban.gov.za/uploads/0000/6/2025/09/21/certificate-of-acceptability-for-food-premises.pdf' },
        ],
      },
    ],
  },

  {
    name: 'City of Cape Town',
    province: 'western_cape',
    short_name: 'Cape Town',
    areas: [
      'Cape Town CBD', 'Khayelitsha', 'Mitchells Plain', 'Gugulethu', 'Nyanga',
      'Langa', 'Delft', 'Philippi', 'Manenberg', 'Hanover Park', 'Atlantis',
      'Bellville', 'Kraaifontein',
    ],
    offices: [
      {
        office_type: 'environmental_health',
        name: 'Environmental Health offices',
        address: 'Various — locate nearest at westerncape.gov.za',
        hours: STD_HOURS,
        online_portal_url: 'https://www.capetown.gov.za/work%20and%20business/doing-business-in-the-city/business-support-and-guidance/informal-trading',
        notes: 'Online CoA application system operational (piloted July 2024). Paper submissions also accepted. 4,000+ CoA applications received by Dec 2024 deadline.',
      },
    ],
    requirements: [
      {
        requirement_type: 'coa',
        fees: 'Free',
        additional_notes: 'Spaza Shop Health & Safety Handbook available for download from Western Cape Government website.',
        documents_required: [
          { name: 'Certificate of Acceptability application', applies_to: 'all', required: true, notes: 'Online or paper submission accepted' },
          { name: 'Certified copy of SA ID', applies_to: 'sa_citizen', required: true },
          { name: 'Certified copy of passport with valid business visa', applies_to: 'foreign_national', required: true },
          { name: 'Proof of premises (lease, title deed, or landlord affidavit)', applies_to: 'all', required: true },
        ],
      },
    ],
  },

  {
    name: 'Mangaung Metropolitan Municipality',
    province: 'free_state',
    short_name: 'Mangaung',
    areas: ['Bloemfontein', 'Botshabelo', 'Thaba Nchu', 'Mangaung'],
    offices: [
      {
        office_type: 'trading_permit',
        name: 'Municipal office',
        address: 'Contact via helpline',
        phone: '0800 111 300',
        hours: STD_HOURS,
        online_form_url: 'https://mangaung.co.za',
        notes: 'Application form available online. Call 0800 111 300 for queries.',
      },
    ],
    requirements: [],
  },
]

async function upsertMunicipality(m: SeedMunicipality): Promise<string> {
  // Upsert by (name, province) — UNIQUE constraint guarantees one row.
  const { data, error } = await admin
    .from('municipalities')
    .upsert(
      { name: m.name, province: m.province, short_name: m.short_name, areas: m.areas },
      { onConflict: 'name,province' },
    )
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

async function replaceOffices(municipalityId: string, offices: SeedOffice[]) {
  const { error: delErr } = await admin
    .from('municipality_offices')
    .delete()
    .eq('municipality_id', municipalityId)
  if (delErr) throw delErr
  if (offices.length === 0) return
  const { error } = await admin
    .from('municipality_offices')
    .insert(offices.map((o) => ({ ...o, municipality_id: municipalityId })))
  if (error) throw error
}

async function replaceRequirements(municipalityId: string, requirements: SeedRequirement[]) {
  const { error: delErr } = await admin
    .from('municipality_requirements')
    .delete()
    .eq('municipality_id', municipalityId)
  if (delErr) throw delErr
  if (requirements.length === 0) return
  const { error } = await admin
    .from('municipality_requirements')
    .insert(requirements.map((r) => ({ ...r, municipality_id: municipalityId })))
  if (error) throw error
}

async function main() {
  console.log(`Seeding ${MUNICIPALITIES.length} municipalities...\n`)

  for (const m of MUNICIPALITIES) {
    process.stdout.write(`  ${m.short_name} (${m.province})... `)
    const id = await upsertMunicipality(m)
    await replaceOffices(id, m.offices)
    await replaceRequirements(id, m.requirements)
    console.log(`OK (${m.offices.length} offices, ${m.requirements.length} requirements)`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('\nSeed failed:', err)
  process.exit(1)
})
