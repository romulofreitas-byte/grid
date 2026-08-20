-- GRID CRM v1 — isolated deal board (not saved_leads).
-- Additive. Safe to re-run.

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
    check (kind in ('ligar', 'whatsapp', 'reuniao', 'followup', 'proposta')),
  constraint crm_activities_status_chk
    check (status in ('open', 'done'))
);
create index if not exists crm_activities_deal_idx
  on crm_activities (deal_id, status);
create unique index if not exists crm_activities_one_open
  on crm_activities (deal_id) where status = 'open';

alter table crm_pipelines enable row level security;
alter table crm_stages enable row level security;
alter table crm_deals enable row level security;
alter table crm_activities enable row level security;

drop policy if exists crm_pipelines_own on crm_pipelines;
create policy crm_pipelines_own on crm_pipelines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists crm_stages_own on crm_stages;
create policy crm_stages_own on crm_stages
  for all using (
    exists (
      select 1 from crm_pipelines p
      where p.id = pipeline_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from crm_pipelines p
      where p.id = pipeline_id and p.user_id = auth.uid()
    )
  );

drop policy if exists crm_deals_own on crm_deals;
create policy crm_deals_own on crm_deals
  for all using (
    exists (
      select 1 from crm_pipelines p
      where p.id = pipeline_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from crm_pipelines p
      where p.id = pipeline_id and p.user_id = auth.uid()
    )
  );

drop policy if exists crm_activities_own on crm_activities;
create policy crm_activities_own on crm_activities
  for all using (
    exists (
      select 1
      from crm_deals d
      join crm_pipelines p on p.id = d.pipeline_id
      where d.id = deal_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from crm_deals d
      join crm_pipelines p on p.id = d.pipeline_id
      where d.id = deal_id and p.user_id = auth.uid()
    )
  );
