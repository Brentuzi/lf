create extension if not exists "pgcrypto";

create table if not exists public.trade_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create index if not exists trade_sessions_user_idx
  on public.trade_sessions (user_id, created_at desc);

alter table public.trade_sessions enable row level security;

create policy "TradeSessions: select own"
  on public.trade_sessions for select
  using (auth.uid() = user_id);

create policy "TradeSessions: insert own"
  on public.trade_sessions for insert
  with check (auth.uid() = user_id);

create policy "TradeSessions: update own"
  on public.trade_sessions for update
  using (auth.uid() = user_id);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  session_id uuid not null references public.trade_sessions on delete cascade,
  symbol text not null,
  market_type text,
  order_type text,
  side text,
  quote_amount numeric,
  quote_asset text,
  price numeric,
  price_asset text,
  base_amount numeric,
  base_asset text,
  fee_amount numeric,
  fee_asset text,
  trade_time timestamp,
  order_id text,
  trade_id text,
  created_at timestamptz default now()
);

create unique index if not exists trades_unique_key
  on public.trades (user_id, session_id, order_id, trade_id, trade_time);

alter table public.trades enable row level security;

create policy "Trades: select own"
  on public.trades for select
  using (auth.uid() = user_id);

create policy "Trades: insert own"
  on public.trades for insert
  with check (auth.uid() = user_id);

create policy "Trades: update own"
  on public.trades for update
  using (auth.uid() = user_id);
