-- GRID Fase 4 sketch — outbound integrations (CRM / dialer / VOIP / webhook).
-- Additive only. Credentials are ciphertext; decrypt with INTEGRATION_KMS_KEY in the app.
-- Inbound webhook routes authenticate via HMAC, then write with the service role.

create table if not exists integration_connections (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  provider                text not null,
  kind                    text not null,
  display_name            text,
  status                  text not null default 'pending',
  credentials_ciphertext  bytea,
  credentials_nonce       bytea,
  oauth_expires_at        timestamptz,
  caller_id               text,
  config                  jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint integration_connections_kind_chk
    check (kind in ('crm', 'dialer', 'voip', 'webhook')),
  constraint integration_connections_provider_chk
    check (provider in (
      'webhook', 'pipedrive', 'hubspot', 'rdstation', 'kommo', 'salesforce',
      '3cplus', 'megadialer', 'twilio', 'zenvia', 'asterisk'
    )),
  constraint integration_connections_status_chk
    check (status in ('pending', 'active', 'error', 'revoked'))
);

create index if not exists integration_connections_user_idx
  on integration_connections (user_id, kind);

comment on table integration_connections is
  'Per-Piloto destination. Tokens live in credentials_ciphertext (AES-GCM), never in .env.';
comment on column integration_connections.config is
  'Field map, webhook URL, campaign id, Salesforce Lead vs Account+Contact, etc.';
comment on column integration_connections.caller_id is
  'Ramal / From for originate_call (Twilio number, Asterisk extension, 3C Plus agent).';

create table if not exists integration_jobs (
  id             bigserial primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  connection_id  uuid not null references integration_connections(id) on delete cascade,
  search_id      uuid references searches(id) on delete set null,
  verb           text not null,
  provider       text not null,
  status         text not null default 'pending',
  attempts       int not null default 0,
  last_error     text,
  payload        jsonb,
  result         jsonb,
  locked_at      timestamptz,
  created_at     timestamptz not null default now(),
  finished_at    timestamptz,
  constraint integration_jobs_verb_chk
    check (verb in ('push_list', 'originate_call')),
  constraint integration_jobs_status_chk
    check (status in ('pending', 'running', 'done', 'failed'))
);

create index if not exists integration_jobs_status_idx
  on integration_jobs (status, created_at);
create index if not exists integration_jobs_user_idx
  on integration_jobs (user_id, created_at desc);
create index if not exists integration_jobs_search_idx
  on integration_jobs (search_id);

comment on table integration_jobs is
  'Outbound queue. push_list shares debitExport (once per CNPJ). originate_call is free.';

create table if not exists integration_events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  connection_id    uuid references integration_connections(id) on delete set null,
  job_id           bigint references integration_jobs(id) on delete set null,
  direction        text not null,
  event_type       text not null,
  cnpj             char(14),
  e164             text,
  external_id      text,
  disposition      text,
  lead_status      text,
  payload_summary  jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  constraint integration_events_direction_chk
    check (direction in ('inbound', 'outbound')),
  constraint integration_events_lead_status_chk
    check (lead_status is null or lead_status in ('novo', 'ligando', 'reuniao', 'descartado'))
);

create index if not exists integration_events_user_idx
  on integration_events (user_id, created_at desc);
create index if not exists integration_events_cnpj_idx
  on integration_events (cnpj);

comment on table integration_events is
  'Audit trail. Inbound call.outcome updates saved_leads.status after HMAC verify.';

create table if not exists integration_external_ids (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  connection_id   uuid not null references integration_connections(id) on delete cascade,
  provider        text not null,
  cnpj            char(14) not null,
  external_id     text not null,
  external_kind   text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (connection_id, cnpj, external_kind)
);

create index if not exists integration_external_ids_lookup_idx
  on integration_external_ids (connection_id, cnpj);

comment on table integration_external_ids is
  'Idempotency map: GRID CNPJ → Pipedrive org / HubSpot company / dialer mailing row.';

alter table integration_connections enable row level security;
alter table integration_jobs enable row level security;
alter table integration_events enable row level security;
alter table integration_external_ids enable row level security;

create policy "integration_connections_own" on integration_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "integration_jobs_own" on integration_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "integration_events_own" on integration_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "integration_external_ids_own" on integration_external_ids
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
