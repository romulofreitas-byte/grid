-- Last inbound POSTs per automation campaign (Make/form → CRM).
-- Additive. Safe to re-run.

create table if not exists crm_inbound_events (
  id           uuid primary key default gen_random_uuid(),
  endpoint_id  uuid not null references crm_inbound_endpoints(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  status       text not null,
  http_status  int not null,
  message      text not null default '',
  deal_id      uuid,
  snapshot     jsonb not null default '{}'::jsonb,
  payload      jsonb,
  created_at   timestamptz not null default now(),
  constraint crm_inbound_events_status_chk
    check (status in ('created', 'skipped', 'error'))
);

create index if not exists crm_inbound_events_endpoint_idx
  on crm_inbound_events (endpoint_id, created_at desc);

create index if not exists crm_inbound_events_user_idx
  on crm_inbound_events (user_id, created_at desc);

alter table crm_inbound_events enable row level security;

drop policy if exists crm_inbound_events_own on crm_inbound_events;
create policy crm_inbound_events_own on crm_inbound_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
