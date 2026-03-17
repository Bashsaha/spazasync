/**
 * Set a user as platform admin.
 *
 * Usage: npx tsx scripts/set-admin.ts user@example.com
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * in .env.local (or environment variables).
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const email = process.argv[2]

if (!email) {
  console.error('Usage: npx tsx scripts/set-admin.ts <email>')
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Look up user by email
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers()

  if (listErr) {
    console.error('Failed to list users:', listErr.message)
    process.exit(1)
  }

  const user = users.find((u) => u.email === email)

  if (!user) {
    console.error(`No user found with email: ${email}`)
    process.exit(1)
  }

  const existingMeta = user.app_metadata ?? {}
  const shopId = existingMeta.shop_id as string | undefined

  // Explicitly merge to preserve shop_id and other metadata
  const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...existingMeta, role: 'admin' },
  })

  if (updateErr) {
    console.error('Failed to update user:', updateErr.message)
    process.exit(1)
  }

  console.log(`Successfully set ${email} (${user.id}) as admin.`)
  if (shopId) {
    console.log(`  shop_id: ${shopId} — dual-role access (admin + shop owner)`)
  } else {
    console.log(`  No shop linked — admin-only (no shop access)`)
  }
}

main()
