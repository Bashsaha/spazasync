/**
 * Shared types for the admin EFT reconciliation feature.
 *
 * A bank export (OFX or CSV) is parsed by a format adapter into a list of
 * normalized `ParsedDeposit`s. The match engine then classifies each against
 * the shop roster, and the DB layer applies the confident ones — extending the
 * matched shop's subscription with renewal-aware date math.
 *
 * Keeping the adapter output format-agnostic means OFX, FNB CSV, a generic CSV,
 * or a future bank-feed API all feed the same engine with zero rework.
 */

/** One incoming credit (deposit) normalized from any bank export format. */
export interface ParsedDeposit {
  /** ISO date, YYYY-MM-DD */
  date: string
  /** Positive Rand amount (credits only — debits are dropped by the adapter) */
  amount: number
  /** Human-readable reference / description (payer's reference lands here) */
  reference: string
  /** Original unmodified description text, for display */
  rawDescription: string
  /** 1-based source line/transaction number, for display */
  lineNo: number
}

/** Maps a semantic field to a 0-based CSV column index. */
export interface ColumnMap {
  date: number
  amount: number
  reference: number
}

/** Subscription-relevant subset of a shop row, used by the match engine. */
export interface ShopSubInfo {
  id: string
  code: string
  name: string
  subscription_status: string
  subscription_ends_at: string | null
  trial_ends_at: string | null
}

export type MatchOutcome = 'applied' | 'needs_review' | 'unmatched' | 'duplicate'

/** A deposit after classification against the shop roster. */
export interface ClassifiedDeposit {
  deposit: ParsedDeposit
  dedupeKey: string
  outcome: MatchOutcome
  matchedCode: string | null
  shopId: string | null
  months: number | null
  reason: string
}

// ── Reconcile report (returned by the API to the admin UI) ───────────────────

export interface ReconcileApplied {
  shopId: string
  shopName: string
  code: string
  amount: number
  months: number
  date: string
  reference: string
  previousEndsAt: string | null
  newEndsAt: string
}

/** A deposit that needs the admin's attention (ambiguous / underpaid / no code). */
export interface ReconcilePending {
  dedupeKey: string
  date: string
  amount: number
  reference: string
  candidateCode: string | null
  candidateShopId: string | null
  candidateShopName: string | null
  reason: string
}

export interface ReconcileDuplicate {
  date: string
  amount: number
  reference: string
  reason: string
}

/** Minimal shop option for the manual-apply picker. */
export interface ShopOption {
  id: string
  code: string
  name: string
}

export interface ReconcileReport {
  applied: ReconcileApplied[]
  needsReview: ReconcilePending[]
  unmatched: ReconcilePending[]
  duplicates: ReconcileDuplicate[]
  parseErrors: string[]
  /** Full roster, so the UI's manual-apply picker needs no extra fetch. */
  shops: ShopOption[]
  summary: {
    totalDeposits: number
    applied: number
    needsReview: number
    unmatched: number
    duplicates: number
  }
}
