/**
 * Per-request shop fetcher.
 *
 * Multiple server components on the dashboard each used to re-query the
 * `shops` row independently (layout → name/language; dashboard page → 11
 * subscription/onboarding fields; JourneyProgressCard → has_employees +
 * fund_interest; getDashboardReminder → 5 fund-related fields). That meant
 * the same row was read 3-4× per dashboard render.
 *
 * `React.cache()` dedupes within a single server render: the first caller
 * runs the query, every subsequent caller (anywhere in the tree) gets the
 * memoised result for free. We pull a superset of columns once so any
 * caller can read what they need without forcing a wider DB hit.
 */
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Shop } from '@/types'

/**
 * Common subset of shop columns read across the dashboard render. Includes
 * every column any current caller needs — extend here when a new field is
 * added rather than spawning a parallel read.
 */
export const SHOP_DEDUP_COLUMNS = [
  'id',
  'name',
  'code',
  'language',
  'low_stock_threshold',
  'subscription_status',
  'trial_ends_at',
  'subscription_ends_at',
  'profit_tracking_enabled',
  'municipality_id',
  'onboarding_compliance_completed',
  'onboarding_compliance_dismissed_at',
  'onboarding_compliance_dismiss_count',
  'has_employees',
  'fund_interest',
  'fund_township_rural',
  'fund_owner_managed',
  'sars_grace_period_until',
].join(', ')

export type DedupShop = Partial<Shop> & { id: string }

/**
 * Request-scoped memoised shop fetch. Pass an explicit Supabase client when
 * the caller already created one (e.g. middleware-style); otherwise we
 * create the request-scoped server client.
 */
export const getShopForRequest = cache(
  async (shopId: string, client?: SupabaseClient): Promise<DedupShop | null> => {
    const supabase = client ?? (await createClient())
    const { data } = await supabase
      .from('shops')
      .select(SHOP_DEDUP_COLUMNS)
      .eq('id', shopId)
      .maybeSingle()
    return (data as DedupShop | null) ?? null
  },
)
