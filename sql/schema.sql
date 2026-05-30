-- sql/schema.sql
-- Financial Ledger — database schema for Supabase Postgres.
-- Apply once from the Supabase SQL editor.
--
-- Key properties:
--   * `user_id` references auth.users — every row belongs to one account.
--   * Row-Level Security is mandatory; the policies below scope every
--     SELECT / INSERT / UPDATE / DELETE to `auth.uid()`.
--   * `has_discount` carries `discount_amount` and `original_amount` —
--     `amount` is what was actually paid; `original_amount = amount + discount_amount`.

-- ─── Table ──────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id                bigserial primary key,
  date              date        not null,
  type              text        not null check (type in ('Income', 'Expense')),
  amount            float8      not null check (amount > 0),
  currency          text        not null check (currency in ('IDR', 'USD')),
  category          text        not null,
  vendor_location   text        default '',

  -- Discount tracking
  has_discount      boolean     not null default false,
  discount_amount   float8      not null default 0  check (discount_amount >= 0),
  original_amount   float8      not null default 0  check (original_amount >= 0),

  is_subscription   boolean     not null default false,

  -- Ownership + audit
  user_id           uuid        not null references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- A row marked has_discount must carry a non-negative discount and an
  -- original_amount equal to amount + discount_amount (small float tolerance).
  constraint discount_consistent check (
    (has_discount = false)
    or (discount_amount >= 0 and abs(original_amount - (amount + discount_amount)) < 0.01)
  )
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc, id desc);

-- ─── Row-Level Security ─────────────────────────────────────────────────
alter table public.transactions enable row level security;

-- Drop any pre-existing policies before recreating (so the file is idempotent).
drop policy if exists "transactions_select_own"  on public.transactions;
drop policy if exists "transactions_insert_own"  on public.transactions;
drop policy if exists "transactions_update_own"  on public.transactions;
drop policy if exists "transactions_delete_own"  on public.transactions;

create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "transactions_insert_own"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "transactions_update_own"
  on public.transactions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "transactions_delete_own"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- ─── Auto-touch updated_at ──────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists transactions_touch_updated_at on public.transactions;
create trigger transactions_touch_updated_at
  before update on public.transactions
  for each row execute procedure public.touch_updated_at();
