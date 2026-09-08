-- Piloto Pro: GRID-hosted forms + native Meta Instant Forms.
-- Additive. Safe to re-run.

create table if not exists crm_meta_connections (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references profiles(id) on delete cascade,
  page_id                 text not null,
  page_name               text not null,
  status                  text not null default 'active',
  credentials_ciphertext  text not null,
  credentials_nonce       text not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint crm_meta_connections_status_chk
    check (status in ('pending', 'active', 'error', 'revoked')),
  constraint crm_meta_connections_user_page_uidx unique (user_id, page_id)
);

create index if not exists crm_meta_connections_page_idx
  on crm_meta_connections (page_id);

alter table crm_meta_connections enable row level security;

alter table crm_inbound_endpoints
  add column if not exists public_token_hash text;

alter table crm_inbound_endpoints
  add column if not exists form_fields jsonb not null default '{}'::jsonb;

alter table crm_inbound_endpoints
  add column if not exists meta_connection_id uuid references crm_meta_connections(id) on delete set null;

alter table crm_inbound_endpoints
  add column if not exists meta_form_id text;

alter table crm_inbound_endpoints
  drop constraint if exists crm_inbound_endpoints_channel_chk;

alter table crm_inbound_endpoints
  add constraint crm_inbound_endpoints_channel_chk
  check (channel in ('ads', 'site', 'meta', 'webhook'));

create unique index if not exists crm_inbound_endpoints_public_token_uidx
  on crm_inbound_endpoints (public_token_hash)
  where public_token_hash is not null;

create index if not exists crm_inbound_endpoints_meta_idx
  on crm_inbound_endpoints (meta_connection_id)
  where meta_connection_id is not null;

alter table crm_inbound_events
  add column if not exists external_id text;

create unique index if not exists crm_inbound_events_external_uidx
  on crm_inbound_events (endpoint_id, external_id)
  where external_id is not null;
