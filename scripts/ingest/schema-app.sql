-- GRID app tables for vanilla Postgres (Docker). No auth.users, no RLS.
-- RF tables live in schema-rf.sql and are applied by docker-entrypoint / ingest.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id              uuid primary key default gen_random_uuid(),
  nome            text,
  plano           text not null default 'free',
  creditos        int  not null default 25,
  especialidade   text,
  area            text,
  empresa_usuario text,
  cidade_usuario  text,
  documento       text,
  documento_tipo  text,
  foto_url        text,
  como_chama      text,
  tratamento      text,
  promessa        text,
  duracao_reuniao int not null default 20,
  meta_ligacoes_dia int not null default 20,
  onboarding_completed_at timestamptz,
  created_at      timestamptz default now()
);

create table if not exists searches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  nome        text not null,
  filtros     jsonb not null,
  total_found int,
  saved       boolean not null default false,
  created_at  timestamptz default now()
);
create index if not exists searches_user_idx on searches (user_id, created_at desc);

create table if not exists saved_leads (
  id            uuid primary key default gen_random_uuid(),
  search_id     uuid not null references searches(id) on delete cascade,
  user_id       uuid not null,
  cnpj          char(14) not null,
  grid_score    int,
  grid_position int,
  enrichment    jsonb,
  status        text default 'novo',
  notas         text,
  created_at    timestamptz default now(),
  unique (search_id, cnpj)
);
create index if not exists saved_leads_search_idx on saved_leads (search_id, grid_position);

alter table profiles add column if not exists foto_url text;
alter table profiles add column if not exists como_chama text;
alter table profiles add column if not exists tratamento text;
alter table profiles add column if not exists promessa text;
alter table profiles add column if not exists duracao_reuniao int not null default 20;
alter table profiles add column if not exists meta_ligacoes_dia int not null default 20;
alter table profiles add column if not exists onboarding_completed_at timestamptz;

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

create table if not exists opt_outs (
  id          uuid primary key default gen_random_uuid(),
  documento   text not null unique,
  motivo      text,
  created_at  timestamptz default now()
);

create table if not exists niche_presets (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  nome         text not null,
  grupo        text not null,
  perfil_score text not null,
  parent_id    uuid references niche_presets(id) on delete cascade,
  keywords     text[] not null,
  exclusoes    text[] default '{}',
  name_stems   text[] default '{}',
  aliases      text[] default '{}',
  curado       boolean default false,
  ordem        int default 0
);

-- Idempotent for existing DBs
alter table niche_presets add column if not exists aliases text[] default '{}';

create table if not exists niche_preset_cnaes (
  preset_id  uuid not null references niche_presets(id) on delete cascade,
  cnae       char(7) not null,
  incluido   boolean not null default true,
  primary key (preset_id, cnae)
);

create table if not exists lead_enrichment (
  cnpj           char(14) primary key,
  domain         text,
  domain_status  text not null default 'nao_encontrado',
  http_status    int,
  phones         jsonb not null default '[]',
  emails         jsonb not null default '[]',
  whatsapp       text,
  socials        jsonb not null default '{}',
  tech           jsonb not null default '{}',
  freshness      jsonb not null default '{}',
  osm            jsonb,
  dor_digital    int,
  contexto       text[] not null default '{}',
  fonte          jsonb not null default '{}',
  people         jsonb,
  stage          text not null default 'complete',
  collected_at   timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '30 days')
);
create index if not exists lead_enrichment_expires_idx on lead_enrichment (expires_at);
alter table lead_enrichment add column if not exists people jsonb;
alter table lead_enrichment add column if not exists stage text not null default 'complete';

create table if not exists enrichment_jobs (
  id           bigserial primary key,
  cnpj         char(14) not null,
  requested_by uuid,
  search_id    uuid references searches(id) on delete cascade,
  status       text not null default 'pending',
  attempts     int not null default 0,
  last_error   text,
  locked_at    timestamptz,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz,
  priority     smallint not null default 0
);
alter table enrichment_jobs add column if not exists priority smallint not null default 0;
create index if not exists enrichment_jobs_status_idx on enrichment_jobs (status, created_at);
create index if not exists enrichment_jobs_search_idx on enrichment_jobs (search_id);
create index if not exists enrichment_jobs_claim_idx
  on enrichment_jobs (priority desc, created_at)
  where status in ('pending', 'running');
create unique index if not exists enrichment_jobs_active_cnpj
  on enrichment_jobs (cnpj) where status in ('pending', 'running');

create table if not exists domain_cache (
  cnpj_basico  char(8) primary key,
  domain       text,
  status       text not null,
  resolved_at  timestamptz not null default now()
);

insert into profiles (
  id, nome, plano, creditos, especialidade, area, empresa_usuario, cidade_usuario,
  como_chama, tratamento, duracao_reuniao, meta_ligacoes_dia, created_at
) values (
  '00000000-0000-4000-8000-000000000001',
  'Rômulo Freitas',
  'free',
  25,
  'marketing digital',
  'vendas',
  'Combustível',
  'BH',
  'Rômulo',
  'o',
  20,
  20,
  '2026-01-01T12:00:00.000Z'
) on conflict (id) do nothing;

create table if not exists usage_daily (
  user_id   uuid not null references profiles(id) on delete cascade,
  bucket    text not null,
  day_sp    date not null default (timezone('America/Sao_Paulo', now())::date),
  count     int  not null default 0,
  primary key (user_id, bucket, day_sp)
);
create index if not exists usage_daily_day_idx on usage_daily (day_sp, bucket);

create table if not exists crm_pipelines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  nome        text not null,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists crm_pipelines_user_idx
  on crm_pipelines (user_id, position);

create table if not exists crm_stages (
  id           uuid primary key default gen_random_uuid(),
  pipeline_id  uuid not null references crm_pipelines(id) on delete cascade,
  nome         text not null,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists crm_stages_pipeline_idx
  on crm_stages (pipeline_id, position);

create table if not exists crm_deals (
  id             uuid primary key default gen_random_uuid(),
  pipeline_id    uuid not null references crm_pipelines(id) on delete cascade,
  stage_id       uuid not null references crm_stages(id) on delete restrict,
  company_name   text not null,
  contact_name   text not null default '',
  secretaries    jsonb not null default '[]'::jsonb,
  phones         jsonb not null default '[]'::jsonb,
  notes          text not null default '',
  position       int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists crm_deals_stage_idx
  on crm_deals (stage_id, position);
create index if not exists crm_deals_pipeline_idx
  on crm_deals (pipeline_id);

create table if not exists crm_activities (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references crm_deals(id) on delete cascade,
  kind        text not null,
  due_at      timestamptz not null,
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  constraint crm_activities_kind_chk
    check (kind in ('ligar', 'whatsapp', 'email', 'reuniao', 'followup', 'proposta', 'nota')),
  constraint crm_activities_status_chk
    check (status in ('open', 'done'))
);
create index if not exists crm_activities_deal_idx
  on crm_activities (deal_id, status);
create unique index if not exists crm_activities_one_open
  on crm_activities (deal_id) where status = 'open';

