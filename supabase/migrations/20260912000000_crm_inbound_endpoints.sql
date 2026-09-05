-- GRID inbound lead endpoint (Make/Zapier/forms → CRM deals).
-- Additive. Safe to re-run.

create table if not exists crm_inbound_endpoints (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  pipeline_id  uuid not null references crm_pipelines(id) on delete cascade,
  stage_id     uuid references crm_stages(id) on delete set null,
  token_hash   text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint crm_inbound_endpoints_user_uidx unique (user_id)
);

create index if not exists crm_inbound_endpoints_token_idx
  on crm_inbound_endpoints (token_hash);

alter table crm_inbound_endpoints enable row level security;

drop policy if exists crm_inbound_endpoints_own on crm_inbound_endpoints;
create policy crm_inbound_endpoints_own on crm_inbound_endpoints
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
