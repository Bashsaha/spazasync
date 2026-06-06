# Supabase Runbook

How the database is managed, and the **one known reproducibility gap** you must close before
trusting a freshly-provisioned database.

---

## How migrations are applied

This project does **not** use `supabase db push`. To set up or update a database:

1. Open the Supabase project → **SQL Editor**.
2. Run every file in `supabase/migrations/` **in numeric order** (`001_…` → `037_…`).
3. Each migration is written to be idempotent / safe to re-run where practical.

To verify a table exists after applying:

```bash
curl -s "https://<project>.supabase.co/rest/v1/<table>?select=id&limit=0" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# returns [] if the table exists
```

---

## ⚠️ Known gap: "Phase 45" objects are NOT in the migrations folder

During the Phase 45 scalability work, a batch of database objects was applied **directly to the
production database via the SQL Editor and never captured as a numbered migration file** (this was
a deliberate inline-SQL workflow at the time). The application's hot paths depend on these objects.

**Consequence:** if you provision a new database by running migrations `001`–`037` only, it will be
missing the objects below. The app will appear to work but will hit the bugs Phase 45 fixed
(e.g. statistics truncating past ~20k sales, an N+1 sale-completion path, an always-on realtime
socket).

### Objects that must exist (but aren't in `migrations/`)

| Object | Type | Purpose |
|---|---|---|
| `complete_sale(p_shop_id, p_teller_id, p_offline_id, p_items jsonb)` | RPC | One-transaction sale (insert sale + items + FEFO per line); idempotent on `offline_id` |
| `shop_daily_summary(...)` | RPC | `GROUP BY` aggregate for the daily summary |
| `shop_sales_statistics(...)` | RPC | `GROUP BY` aggregate for sales statistics (replaces JS row-pull + 20k truncation) |
| `shop_popular_products(...)` | RPC | `GROUP BY` aggregate for popular products |
| `expire_due_shops()` | RPC | Bulk-flip due shops → expired (cron) |
| `broadcast_shop_change()` | Trigger fn | AFTER trigger on `sales` (INSERT) + `access_requests` (I/U/D) → `realtime.broadcast_changes` |
| `db_size_stats()` | RPC | Service-role DB-size widget |
| `archive_old_sales(p_before, p_batch)` | RPC | Moves sales >18 months into the cold archive |
| `sales_archive`, `sale_items_archive` | Tables | Partitioned-by-month cold storage, RLS enabled, no policies |
| Composite indexes | Indexes | esp. `sales(shop_id, completed_at DESC)`; 6 redundant single-col indexes were dropped |
| RLS policy rewrites | Policies | All 18 shop-scoped policies rewritten to the set-membership form |

> The **authoritative SQL** for these objects is **not in this repository.** It must be kept as a
> runbook copy (it was originally pasted into the build chat). **Action owed:** paste the verified
> production SQL into a new migration `supabase/migrations/038_phase45_scalability.sql` (or append it
> below this section) so the database is fully reproducible from the repo. Until then, a new database
> is not a faithful copy of production.

### How to recover the exact SQL from the live database

If the runbook copy is lost, the deployed definitions can be dumped from production:

```sql
-- Function bodies
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname IN ('complete_sale','shop_daily_summary','shop_sales_statistics',
                  'shop_popular_products','expire_due_shops','broadcast_shop_change',
                  'db_size_stats','archive_old_sales');

-- Policies
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- Indexes
SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;
```

Paste the results into `038_phase45_scalability.sql`, review, and commit. Then this gap is closed.

---

## Access rules for tooling (e.g. Claude / scripts)

- **Read** via the REST API with the service-role key from `.env.local`.
- **Schema writes are performed only by a human** in the SQL Editor. Automated tooling must not
  attempt migrations or schema changes — it outputs SQL for a human to paste.
