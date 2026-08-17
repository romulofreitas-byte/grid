-- Remaining schema for founder opening (vanilla Postgres).
-- Safe to re-run: IF NOT EXISTS / ON CONFLICT.

create extension if not exists pgcrypto;

alter table profiles add column if not exists documento text;
alter table profiles add column if not exists documento_tipo text;
alter table profiles add column if not exists foto_url text;
alter table profiles add column if not exists como_chama text;
alter table profiles add column if not exists tratamento text;
alter table profiles add column if not exists promessa text;
alter table profiles add column if not exists duracao_reuniao int not null default 20;
alter table profiles add column if not exists meta_ligacoes_dia int not null default 20;
alter table profiles add column if not exists onboarding_completed_at timestamptz;

alter table profiles drop constraint if exists profiles_tratamento_check;
alter table profiles add constraint profiles_tratamento_check
  check (tratamento is null or tratamento in ('o', 'a', 'e'));

create table if not exists call_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  cnpj           char(14) not null,
  saved_lead_id  uuid references saved_leads(id) on delete set null,
  source         text not null check (source in ('status', 'dialer', 'manual')),
  created_at     timestamptz not null default now(),
  day_sp         date not null default (timezone('America/Sao_Paulo', now())::date),
  unique (user_id, cnpj, day_sp)
);
create index if not exists call_events_user_day_idx
  on call_events (user_id, created_at desc);

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

-- Founder / local Piloto: 60 days, 900 credits (WDL bundle).
update profiles
set plano = 'piloto', creditos = 900
where id = '00000000-0000-4000-8000-000000000001';

insert into credit_lots (id, profile_id, qty, remaining, source, expires_at, created_at)
select
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000001',
  900,
  900,
  'plan_grant',
  now() + interval '60 days',
  now()
where not exists (
  select 1 from credit_lots
  where profile_id = '00000000-0000-4000-8000-000000000001'
    and source = 'plan_grant'
    and remaining > 0
);

insert into billing_subscriptions (
  id, profile_id, plan, status, provider,
  current_period_start, current_period_end, cancel_at_period_end
)
select
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000001',
  'piloto',
  'active',
  'platform',
  now(),
  now() + interval '60 days',
  false
where not exists (
  select 1 from billing_subscriptions
  where profile_id = '00000000-0000-4000-8000-000000000001'
    and status = 'active'
);
