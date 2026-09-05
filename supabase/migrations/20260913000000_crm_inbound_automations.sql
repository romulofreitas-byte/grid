-- GRID inbound automations: many endpoints per account (nome, kind, channel).
-- Additive. Safe to re-run.

alter table crm_inbound_endpoints
  drop constraint if exists crm_inbound_endpoints_user_uidx;

alter table crm_inbound_endpoints
  add column if not exists nome text not null default 'Campanha';

alter table crm_inbound_endpoints
  add column if not exists lead_kind text not null default 'company';

alter table crm_inbound_endpoints
  add column if not exists channel text not null default 'site';

alter table crm_inbound_endpoints
  drop constraint if exists crm_inbound_endpoints_lead_kind_chk;

alter table crm_inbound_endpoints
  add constraint crm_inbound_endpoints_lead_kind_chk
  check (lead_kind in ('company', 'person'));

alter table crm_inbound_endpoints
  drop constraint if exists crm_inbound_endpoints_channel_chk;

alter table crm_inbound_endpoints
  add constraint crm_inbound_endpoints_channel_chk
  check (channel in ('ads', 'site'));

create unique index if not exists crm_inbound_endpoints_token_uidx
  on crm_inbound_endpoints (token_hash);

create index if not exists crm_inbound_endpoints_user_idx
  on crm_inbound_endpoints (user_id);
