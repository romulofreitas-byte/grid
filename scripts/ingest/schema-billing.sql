-- GRID Fase 3 — cobrança, créditos, tesouraria
-- Vanilla Postgres (Docker). Sem auth.users / RLS.

alter table profiles add column if not exists documento text;
alter table profiles add column if not exists documento_tipo text;

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
create unique index if not exists credit_lots_one_open_period
  on credit_lots (
    profile_id,
    source,
    (date_trunc('month', expires_at at time zone 'UTC'))
  )
  where order_id is null
    and remaining > 0
    and expires_at is not null
    and source in ('plan_grant', 'platform');
create unique index if not exists credit_lots_one_per_order
  on credit_lots (order_id)
  where order_id is not null;

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
