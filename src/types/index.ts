// ============================================================
// Movestock — Shared TypeScript types (barrel)
// ============================================================
//
// Types are split by domain into sibling files. This barrel re-exports them all
// so `import { Shop } from '@/types'` keeps working everywhere. Import from the
// barrel, not the domain files, so call sites don't churn if a type moves.
//
//   core.ts        roles, subscription, shop, shop_users, teller, session
//   products.ts    products, stock, batches, expiry, suppliers, goods received
//   sales.ts       sales, cart, offline queue, sales reporting
//   admin.ts       admin dashboard
//   compliance.ts  checklist, documents, waste/pest, score, access requests,
//                  municipality directory, onboarding, journey hub, reminders
// ============================================================

export * from './core'
export * from './products'
export * from './sales'
export * from './admin'
export * from './compliance'
