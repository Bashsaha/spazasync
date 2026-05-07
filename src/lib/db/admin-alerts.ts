/**
 * Phase 37g — admin_alerts CRUD helpers.
 *
 * Reads use the user's session (RLS exposes only currently-active alerts to
 * everyone; admins reading the admin list bypass that filter via service-role).
 * Writes always use service-role since `admin_alerts` has no INSERT/UPDATE
 * policies.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { AdminAlert, CreateAdminAlertInput, UpdateAdminAlertInput } from '@/types'

export async function listAllAdminAlerts(): Promise<AdminAlert[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('admin_alerts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as AdminAlert[]) ?? []
}

export async function getAdminAlert(id: string): Promise<AdminAlert | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('admin_alerts').select('*').eq('id', id).maybeSingle()
  return (data as AdminAlert | null) ?? null
}

export async function createAdminAlert(
  input: CreateAdminAlertInput,
): Promise<AdminAlert> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('admin_alerts')
    .insert({
      title: input.title,
      message: input.message,
      link_text: input.link_text ?? null,
      link_url: input.link_url ?? null,
      priority: input.priority ?? 'normal',
      target_audience: input.target_audience ?? 'all',
      starts_at: input.starts_at ?? new Date().toISOString(),
      expires_at: input.expires_at ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as AdminAlert
}

export async function updateAdminAlert(
  id: string,
  input: UpdateAdminAlertInput,
): Promise<AdminAlert> {
  const admin = createAdminClient()
  const patch: Record<string, unknown> = {}
  for (const k of [
    'title',
    'message',
    'link_text',
    'link_url',
    'priority',
    'target_audience',
    'starts_at',
    'expires_at',
  ] as const) {
    if (k in input) patch[k] = input[k] ?? null
  }
  const { data, error } = await admin
    .from('admin_alerts')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as AdminAlert
}

export async function deleteAdminAlert(id: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('admin_alerts').delete().eq('id', id)
  if (error) throw error
}
