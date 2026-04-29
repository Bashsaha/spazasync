/**
 * Municipality directory — read-only helpers (Phase 37a).
 *
 * Reference data with public-read RLS, so the regular server client is fine.
 * Filtering by nationality / office_type happens here so callers don't have
 * to know the JSONB shape.
 */

import { createClient } from '@/lib/supabase/server'
import type {
  DocumentRequirement,
  Municipality,
  MunicipalityOffice,
  MunicipalityRequirement,
  NationalityType,
  OfficeType,
  Province,
  RequirementType,
} from '@/types'

/** All municipalities, alphabetised by short_name. */
export async function listMunicipalities(): Promise<Municipality[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('municipalities').select('*').order('short_name')
  return (data as Municipality[]) ?? []
}

/** Municipalities in a province, alphabetised by short_name. */
export async function getMunicipalitiesByProvince(province: Province): Promise<Municipality[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('municipalities')
    .select('*')
    .eq('province', province)
    .order('short_name')
  return (data as Municipality[]) ?? []
}

/** One municipality by UUID, or null if not found. */
export async function getMunicipalityById(id: string): Promise<Municipality | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('municipalities')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return (data as Municipality | null) ?? null
}

/**
 * Map a township / suburb / area name to its municipality.
 *
 * Uses the GIN-indexed `areas` array. Case-insensitive: we lowercase the
 * input and match against the lowercased array elements client-side after
 * a broad `cs` (contains) lookup, since Postgres array ops are case-sensitive.
 */
export async function findMunicipalityByArea(areaName: string): Promise<Municipality | null> {
  const trimmed = areaName.trim()
  if (!trimmed) return null

  const supabase = await createClient()
  const { data } = await supabase.from('municipalities').select('*')
  const all = (data as Municipality[] | null) ?? []
  const needle = trimmed.toLowerCase()
  return (
    all.find((m) => m.areas.some((a) => a.toLowerCase() === needle)) ?? null
  )
}

/** Offices for a municipality, optionally filtered by office_type. */
export async function getOfficesForMunicipality(
  municipalityId: string,
  officeType?: OfficeType,
): Promise<MunicipalityOffice[]> {
  const supabase = await createClient()
  let query = supabase
    .from('municipality_offices')
    .select('*')
    .eq('municipality_id', municipalityId)
    .order('name')

  if (officeType) query = query.eq('office_type', officeType)

  const { data } = await query
  return (data as MunicipalityOffice[]) ?? []
}

/**
 * Filter a JSONB requirements array by the owner's nationality.
 * Pure helper — exported so tests don't need a DB. Returns docs where
 * `applies_to ∈ {nationality, 'all'}`.
 */
export function filterRequirementsByNationality(
  docs: DocumentRequirement[],
  nationality: NationalityType,
): DocumentRequirement[] {
  return docs.filter((d) => d.applies_to === 'all' || d.applies_to === nationality)
}

/**
 * Get the requirement row for (municipality, requirement_type) and return
 * the documents filtered to those that apply to the given nationality.
 * Returns null when no row exists.
 */
export async function getRequirements(
  municipalityId: string,
  requirementType: RequirementType,
  nationality: NationalityType,
): Promise<
  | (Omit<MunicipalityRequirement, 'documents_required'> & {
      documents_required: DocumentRequirement[]
    })
  | null
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('municipality_requirements')
    .select('*')
    .eq('municipality_id', municipalityId)
    .eq('requirement_type', requirementType)
    .maybeSingle()

  const row = (data as MunicipalityRequirement | null) ?? null
  if (!row) return null

  return {
    ...row,
    documents_required: filterRequirementsByNationality(row.documents_required, nationality),
  }
}
