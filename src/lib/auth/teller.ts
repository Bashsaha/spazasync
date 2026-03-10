/**
 * Teller auth helpers.
 *
 * Tellers don't have a real email. We synthesise one that is:
 *   - Unique within a shop (name slug + shop code)
 *   - Scoped to a shop so credentials can't cross shops
 *   - Never shown to the teller — they log in with name + password
 *
 * Pattern: {name-slug}@shop-{shop-code}.spazasync.app
 * Example:  maria-dlamini@shop-cape99.spazasync.app
 */

import { createAdminClient } from '@/lib/supabase/admin'

/** Convert a display name to a URL-safe slug */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Build the synthetic email for a teller */
export function buildTellerEmail(tellerName: string, shopCode: string): string {
  const slug = nameToSlug(tellerName)
  const code = shopCode.toLowerCase()
  return `${slug}@shop-${code}.spazasync.app`
}

export interface ProvisionTellerResult {
  authUserId: string
  syntheticEmail: string
}

/**
 * Create a Supabase Auth account for a teller.
 * Called server-side (API route) by the shop owner.
 *
 * Creates the auth user and sets app_metadata so middleware
 * can read the role from the JWT without a DB round-trip.
 */
export async function provisionTellerAccount(
  tellerName: string,
  shopCode: string,
  shopId: string,
  password: string,
): Promise<ProvisionTellerResult> {
  const admin = createAdminClient()
  const syntheticEmail = buildTellerEmail(tellerName, shopCode)

  const { data, error } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password,
    email_confirm: true,  // skip email confirmation — owner sets the password
    app_metadata: {
      role: 'teller',
      shop_id: shopId,
    },
  })

  if (error) throw new Error(`Failed to provision teller account: ${error.message}`)

  return { authUserId: data.user.id, syntheticEmail }
}

/**
 * Update an existing auth user's app_metadata.
 * Used after owner completes onboarding to embed their role in the JWT.
 */
export async function setOwnerMetadata(userId: string, shopId: string): Promise<void> {
  const admin = createAdminClient()

  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      role: 'owner',
      shop_id: shopId,
    },
  })

  if (error) throw new Error(`Failed to set owner metadata: ${error.message}`)
}
