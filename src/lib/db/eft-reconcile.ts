import 'server-only'

/**
 * EFT reconciliation DB layer (service-role / admin only).
 *
 * Orchestrates: load shop roster → classify deposits (pure engine) → auto-apply
 * the confident ones. Applying = claim dedupe row → extend subscription
 * (renewal-aware) → record admin_payment → backfill the dedupe row.
 *
 * Idempotent: `eft_deposits.dedupe_key` is UNIQUE and claimed with
 * ignoreDuplicates, so re-uploading overlapping date ranges never double-credits.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { updateShopUsersSubscription } from '@/lib/auth/teller'
import { classifyDeposit, computeRenewalEnd } from '@/lib/eft/match'
import type {
  ClassifiedDeposit,
  ParsedDeposit,
  ReconcileReport,
  ShopSubInfo,
} from '@/lib/eft/types'

type AdminClient = ReturnType<typeof createAdminClient>

function getPrice(): number {
  return parseFloat(process.env.SUBSCRIPTION_PRICE_ZAR || '349.99')
}

/**
 * Extend a shop's subscription by N months, renewal-aware. Reads the shop's
 * current state (so consecutive applies in one batch stack correctly, since
 * each apply is committed before the next), writes the new end date, and syncs
 * the JWT metadata for all shop users.
 */
async function extendSubscription(
  admin: AdminClient,
  shopId: string,
  months: number,
  now: Date,
): Promise<{ previousEndsAt: string | null; newEndsAt: string }> {
  const { data: shop, error } = await admin
    .from('shops')
    .select('subscription_status, subscription_ends_at, trial_ends_at')
    .eq('id', shopId)
    .single()

  if (error || !shop) throw new Error(`Shop ${shopId} not found for extension`)

  const previousEndsAt = shop.subscription_ends_at ?? null
  const newEnd = computeRenewalEnd(shop, months, now)
  const newEndsAt = newEnd.toISOString()

  const { error: updateErr } = await admin
    .from('shops')
    .update({
      subscription_status: 'manual_override',
      subscription_ends_at: newEndsAt,
      trial_ends_at: null,
      access_granted: true,
    })
    .eq('id', shopId)

  if (updateErr) throw updateErr

  await updateShopUsersSubscription(shopId, 'manual_override', newEndsAt, true)

  return { previousEndsAt, newEndsAt }
}

/**
 * Apply one confident/resolved deposit. Returns null when the deposit is a
 * duplicate (dedupe key already claimed), otherwise the new end date.
 */
async function applyDeposit(
  admin: AdminClient,
  params: {
    dedupeKey: string
    shopId: string
    months: number
    depositDate: string
    amount: number
    reference: string
    matchedCode: string | null
    adminUserId: string
    now: Date
  },
): Promise<{ previousEndsAt: string | null; newEndsAt: string } | null> {
  // 1. Claim the dedupe key atomically. ON CONFLICT DO NOTHING → empty select = duplicate.
  const { data: claimed, error: claimErr } = await admin
    .from('eft_deposits')
    .upsert(
      {
        dedupe_key: params.dedupeKey,
        shop_id: params.shopId,
        deposit_date: params.depositDate,
        amount: params.amount,
        raw_reference: params.reference || null,
        matched_code: params.matchedCode,
        months_applied: params.months,
        uploaded_by: params.adminUserId,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
    .select('id')

  if (claimErr) throw claimErr
  if (!claimed || claimed.length === 0) return null // duplicate
  const eftId = claimed[0].id

  // 2. Extend subscription (renewal-aware) + sync JWT.
  const { previousEndsAt, newEndsAt } = await extendSubscription(
    admin,
    params.shopId,
    params.months,
    params.now,
  )

  // 3. Record the payment in the existing admin_payments ledger.
  const { data: payment, error: payErr } = await admin
    .from('admin_payments')
    .insert({
      shop_id: params.shopId,
      amount: params.amount,
      method: 'eft',
      reference: params.reference || null,
      notes: `Auto-reconciled from bank upload — ${params.months} month(s)`,
      recorded_by: params.adminUserId,
    })
    .select('id')
    .single()

  if (payErr) throw payErr

  // 4. Backfill the dedupe row with the resulting state (audit).
  await admin
    .from('eft_deposits')
    .update({ new_subscription_ends_at: newEndsAt, admin_payment_id: payment.id })
    .eq('id', eftId)

  return { previousEndsAt, newEndsAt }
}

/**
 * Reconcile a parsed batch of deposits: classify, auto-apply confident matches,
 * and return a report for the admin UI.
 */
export async function reconcileDeposits(
  deposits: ParsedDeposit[],
  parseErrors: string[],
  adminUserId: string,
  now: Date = new Date(),
): Promise<ReconcileReport> {
  const admin = createAdminClient()
  const price = getPrice()

  // Shop roster + already-applied dedupe keys.
  const [{ data: shopRows }, { data: appliedRows }] = await Promise.all([
    admin
      .from('shops')
      .select('id, code, name, subscription_status, subscription_ends_at, trial_ends_at'),
    admin.from('eft_deposits').select('dedupe_key'),
  ])

  const shops = (shopRows ?? []) as ShopSubInfo[]
  const shopsByCode = new Map<string, ShopSubInfo>()
  for (const s of shops) shopsByCode.set(s.code, s)
  const knownCodes = shops.map((s) => s.code)
  const appliedKeys = new Set<string>((appliedRows ?? []).map((r) => r.dedupe_key))

  const report: ReconcileReport = {
    applied: [],
    needsReview: [],
    unmatched: [],
    duplicates: [],
    parseErrors,
    shops: shops.map((s) => ({ id: s.id, code: s.code, name: s.name })),
    summary: {
      totalDeposits: deposits.length,
      applied: 0,
      needsReview: 0,
      unmatched: 0,
      duplicates: 0,
    },
  }

  for (const deposit of deposits) {
    const c: ClassifiedDeposit = classifyDeposit(
      deposit,
      shopsByCode,
      knownCodes,
      price,
      appliedKeys,
    )

    if (c.outcome === 'duplicate') {
      report.duplicates.push({
        date: deposit.date,
        amount: deposit.amount,
        reference: deposit.reference,
        reason: c.reason,
      })
      continue
    }

    if (c.outcome === 'applied' && c.shopId && c.months) {
      const shop = shopsByCode.get(c.matchedCode!)!
      const result = await applyDeposit(admin, {
        dedupeKey: c.dedupeKey,
        shopId: c.shopId,
        months: c.months,
        depositDate: deposit.date,
        amount: deposit.amount,
        reference: deposit.reference,
        matchedCode: c.matchedCode,
        adminUserId,
        now,
      })

      if (!result) {
        // Lost the race / already applied this run — count as duplicate.
        report.duplicates.push({
          date: deposit.date,
          amount: deposit.amount,
          reference: deposit.reference,
          reason: 'Already applied in a previous upload',
        })
      } else {
        appliedKeys.add(c.dedupeKey)
        report.applied.push({
          shopId: c.shopId,
          shopName: shop.name,
          code: shop.code,
          amount: deposit.amount,
          months: c.months,
          date: deposit.date,
          reference: deposit.reference,
          previousEndsAt: result.previousEndsAt,
          newEndsAt: result.newEndsAt,
        })
      }
      continue
    }

    // needs_review or unmatched
    const candidateShop = c.matchedCode ? shopsByCode.get(c.matchedCode) : undefined
    const pending = {
      dedupeKey: c.dedupeKey,
      date: deposit.date,
      amount: deposit.amount,
      reference: deposit.reference,
      candidateCode: c.matchedCode,
      candidateShopId: candidateShop?.id ?? null,
      candidateShopName: candidateShop?.name ?? null,
      reason: c.reason,
    }
    if (c.outcome === 'needs_review') report.needsReview.push(pending)
    else report.unmatched.push(pending)
  }

  report.summary = {
    totalDeposits: deposits.length,
    applied: report.applied.length,
    needsReview: report.needsReview.length,
    unmatched: report.unmatched.length,
    duplicates: report.duplicates.length,
  }

  return report
}

/**
 * Manually apply a single reviewed/unmatched deposit to a chosen shop.
 * Same idempotent engine as the batch path.
 */
export async function applyOneDeposit(
  params: {
    dedupe_key: string
    deposit_date: string
    amount: number
    raw_reference: string
    shop_id: string
    months: number
  },
  adminUserId: string,
  now: Date = new Date(),
): Promise<
  | { status: 'applied'; shopName: string; code: string; previousEndsAt: string | null; newEndsAt: string }
  | { status: 'duplicate' }
  | { status: 'shop_not_found' }
> {
  const admin = createAdminClient()

  const { data: shop } = await admin
    .from('shops')
    .select('code, name')
    .eq('id', params.shop_id)
    .single()
  if (!shop) return { status: 'shop_not_found' }

  const result = await applyDeposit(admin, {
    dedupeKey: params.dedupe_key,
    shopId: params.shop_id,
    months: params.months,
    depositDate: params.deposit_date,
    amount: params.amount,
    reference: params.raw_reference,
    matchedCode: shop.code,
    adminUserId,
    now,
  })

  if (!result) return { status: 'duplicate' }
  return {
    status: 'applied',
    shopName: shop.name,
    code: shop.code,
    previousEndsAt: result.previousEndsAt,
    newEndsAt: result.newEndsAt,
  }
}
