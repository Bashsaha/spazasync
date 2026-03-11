-- Phase 8: Stock Management — audit trail for manual stock adjustments

create table stock_adjustments (
  id           uuid        primary key default gen_random_uuid(),
  shop_id      uuid        not null references shops(id) on delete cascade,
  product_id   uuid        not null references products(id) on delete cascade,
  qty_before   int         not null,
  qty_after    int         not null,
  delta        int         not null,
  reason       text,
  adjusted_by  uuid        references auth.users(id),
  adjusted_at  timestamptz not null default now()
);

alter table stock_adjustments enable row level security;

create policy "shop members can manage stock_adjustments"
  on stock_adjustments for all
  using (user_in_shop(shop_id));
