import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeSearch } from '@/lib/utils/search'
import { nowSAST } from '@/lib/utils/date'
import { format } from 'date-fns'
import { dueFollowUps } from '@/lib/field-sales/logic'
import type {
  Lead,
  LeadDetail,
  LeadListItem,
  LeadStatus,
  ShopVisit,
} from '@/types'
import type { z } from 'zod'
import type {
  createLeadSchema,
  updateLeadSchema,
  createVisitSchema,
} from '@/lib/validation/schemas'

type CreateLeadInput = z.infer<typeof createLeadSchema>
type UpdateLeadInput = z.infer<typeof updateLeadSchema>
type CreateVisitInput = z.infer<typeof createVisitSchema>

/** Today as a YYYY-MM-DD string in SAST — the basis for "follow-up due". */
export function todaySAST(): string {
  return format(nowSAST(), 'yyyy-MM-dd')
}

/** Attach visit_count + last_visited_at to a set of leads (one extra query). */
async function withVisitAggregates(leads: Lead[]): Promise<LeadListItem[]> {
  if (leads.length === 0) return []
  const admin = createAdminClient()
  const ids = leads.map((l) => l.id)

  const { data: visits } = await admin
    .from('shop_visits')
    .select('lead_id, visited_at')
    .in('lead_id', ids)

  const countMap = new Map<string, number>()
  const lastMap = new Map<string, string>()
  for (const v of visits ?? []) {
    countMap.set(v.lead_id, (countMap.get(v.lead_id) ?? 0) + 1)
    const prev = lastMap.get(v.lead_id)
    if (!prev || v.visited_at > prev) lastMap.set(v.lead_id, v.visited_at)
  }

  return leads.map((l) => ({
    ...l,
    visit_count: countMap.get(l.id) ?? 0,
    last_visited_at: lastMap.get(l.id) ?? null,
  }))
}

export async function listLeads(opts: {
  search?: string
  status?: LeadStatus
  area?: string
  page: number
  limit: number
}): Promise<{ leads: LeadListItem[]; total: number }> {
  const admin = createAdminClient()

  let query = admin
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (opts.search) {
    const s = sanitizeSearch(opts.search)
    query = query.or(`business_name.ilike.%${s}%,owner_name.ilike.%${s}%,area.ilike.%${s}%`)
  }
  if (opts.status) query = query.eq('status', opts.status)
  if (opts.area) query = query.eq('area', opts.area)

  const from = (opts.page - 1) * opts.limit
  query = query.range(from, from + opts.limit - 1)

  const { data, count, error } = await query
  if (error) throw error

  const leads = await withVisitAggregates((data as Lead[]) ?? [])
  return { leads, total: count ?? 0 }
}

/** Every lead (no paging) — used by the area view + follow-up aggregation. */
export async function listAllLeads(): Promise<LeadListItem[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return withVisitAggregates((data as Lead[]) ?? [])
}

/** Leads whose follow-up is due today or earlier (SAST), soonest first. */
export async function listDueFollowUps(): Promise<LeadListItem[]> {
  const all = await listAllLeads()
  return dueFollowUps(all, todaySAST())
}

export async function getLeadDetail(id: string): Promise<LeadDetail | null> {
  const admin = createAdminClient()
  const { data: lead, error } = await admin.from('leads').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!lead) return null

  const { data: visits } = await admin
    .from('shop_visits')
    .select('*')
    .eq('lead_id', id)
    .order('visited_at', { ascending: false })

  return { ...(lead as Lead), visits: (visits as ShopVisit[]) ?? [] }
}

export async function createLead(input: CreateLeadInput, createdBy: string): Promise<Lead> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leads')
    .insert({
      business_name: input.business_name,
      owner_name: input.owner_name ?? null,
      phone: input.phone ?? null,
      whatsapp_number: input.whatsapp_number ?? null,
      address: input.address ?? null,
      area: input.area ?? null,
      status: input.status ?? 'prospect',
      notes: input.notes ?? null,
      shop_id: input.shop_id ?? null,
      next_follow_up_at: input.next_follow_up_at ?? null,
      next_follow_up_note: input.next_follow_up_note ?? null,
      created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error
  return data as Lead
}

export async function updateLead(id: string, input: UpdateLeadInput): Promise<Lead> {
  const admin = createAdminClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of [
    'business_name',
    'owner_name',
    'phone',
    'whatsapp_number',
    'address',
    'area',
    'status',
    'notes',
    'shop_id',
    'next_follow_up_at',
    'next_follow_up_note',
  ] as const) {
    if (k in input) patch[k] = input[k] ?? null
  }
  const { data, error } = await admin.from('leads').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as Lead
}

export async function deleteLead(id: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('leads').delete().eq('id', id)
  if (error) throw error
}

/**
 * Log a visit against a lead. Optionally updates the parent lead's follow-up
 * reminder in the same call (the visit form lets you set "call back on …").
 */
export async function createVisit(
  leadId: string,
  input: CreateVisitInput,
  visitedBy: string,
): Promise<ShopVisit> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('shop_visits')
    .insert({
      lead_id: leadId,
      visited_at: input.visited_at ?? new Date().toISOString(),
      notes: input.notes ?? null,
      outcome: input.outcome ?? null,
      visited_by: visitedBy,
    })
    .select()
    .single()
  if (error) throw error

  // Sync the lead's follow-up reminder + updated_at off the back of the visit.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('next_follow_up_at' in input) patch.next_follow_up_at = input.next_follow_up_at ?? null
  if ('next_follow_up_note' in input) patch.next_follow_up_note = input.next_follow_up_note ?? null
  await admin.from('leads').update(patch).eq('id', leadId)

  return data as ShopVisit
}
