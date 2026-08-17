-- GRID Fase 3 — cobrança, créditos, tesouraria + identidade

alter table profiles add column if not exists documento text;
alter table profiles add column if not exists documento_tipo text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, plano, creditos)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    'free',
    25
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists billing_customers (
  profile_id          uuid primary key references profiles(id) on delete cascade,
  asaas_customer_id   text,
  stripe_customer_id  text,
  created_at          timestamptz default now()
);

create table if not exists billing_subscriptions (
  id                    uuid primary key,
  profile_id            uuid not null references profiles(id) on delete cascade,
  plan                  text not null,
  status                text not null,
  provider              text not null,
  provider_sub_id       text,
  current_period_start  timestamptz not null,
  current_period_end    timestamptz not null,
  cancel_at_period_end  boolean not null default false,
  created_at            timestamptz default now()
);
create index if not exists billing_sub_profile_idx
  on billing_subscriptions (profile_id, status);

create table if not exists billing_orders (
  id                   uuid primary key,
  profile_id           uuid not null references profiles(id) on delete cascade,
  sku                  text not null,
  kind                 text not null,
  provider             text not null,
  method               text not null,
  status               text not null,
  amount_cents         int not null,
  currency             text not null default 'BRL',
  provider_payment_id  text,
  provider_sub_id      text,
  pix_qr               text,
  pix_copy             text,
  boleto_url           text,
  boleto_line          text,
  checkout_url         text,
  paid_at              timestamptz,
  created_at           timestamptz not null default now()
);
create index if not exists billing_orders_profile_idx
  on billing_orders (profile_id, created_at desc);
create index if not exists billing_orders_provider_pay_idx
  on billing_orders (provider, provider_payment_id);

create table if not exists payment_events (
  id                 uuid primary key default gen_random_uuid(),
  provider           text not null,
  provider_event_id  text not null,
  payload            jsonb not null default '{}',
  created_at         timestamptz default now(),
  unique (provider, provider_event_id)
);

create table if not exists credit_lots (
  id          uuid primary key,
  profile_id  uuid not null references profiles(id) on delete cascade,
  qty         int not null,
  remaining   int not null,
  source      text not null,
  expires_at  timestamptz,
  order_id    uuid references billing_orders(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists credit_lots_open_idx
  on credit_lots (profile_id, remaining) where remaining > 0;

create table if not exists credit_ledger (
  id          uuid primary key,
  profile_id  uuid not null references profiles(id) on delete cascade,
  type        text not null,
  amount      int not null,
  reason      text not null,
  ref         text,
  lot_id      uuid,
  created_at  timestamptz not null default now()
);
create index if not exists credit_ledger_profile_idx
  on credit_ledger (profile_id, created_at desc);

create table if not exists billed_cnpjs (
  profile_id  uuid not null references profiles(id) on delete cascade,
  cnpj        char(14) not null,
  kind        text not null,
  search_id   uuid,
  created_at  timestamptz default now(),
  primary key (profile_id, cnpj, kind)
);

create table if not exists treasury_transfers (
  id                     uuid primary key,
  order_id               uuid not null references billing_orders(id) on delete cascade,
  amount_cents           int not null,
  status                 text not null,
  provider_transfer_id   text,
  error                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists treasury_status_idx
  on treasury_transfers (status, created_at);

alter table billing_customers enable row level security;
alter table billing_subscriptions enable row level security;
alter table billing_orders enable row level security;
alter table payment_events enable row level security;
alter table credit_lots enable row level security;
alter table credit_ledger enable row level security;
alter table billed_cnpjs enable row level security;
alter table treasury_transfers enable row level security;

drop policy if exists billing_customers_own on billing_customers;
create policy billing_customers_own on billing_customers
  for select using (profile_id = auth.uid());
drop policy if exists billing_subscriptions_own on billing_subscriptions;
create policy billing_subscriptions_own on billing_subscriptions
  for select using (profile_id = auth.uid());
drop policy if exists billing_orders_own on billing_orders;
create policy billing_orders_own on billing_orders
  for select using (profile_id = auth.uid());
drop policy if exists credit_lots_own on credit_lots;
create policy credit_lots_own on credit_lots
  for select using (profile_id = auth.uid());
drop policy if exists credit_ledger_own on credit_ledger;
create policy credit_ledger_own on credit_ledger
  for select using (profile_id = auth.uid());
drop policy if exists billed_cnpjs_own on billed_cnpjs;
create policy billed_cnpjs_own on billed_cnpjs
  for select using (profile_id = auth.uid());
