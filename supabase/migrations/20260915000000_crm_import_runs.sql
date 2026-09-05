-- Spreadsheet import history (last runs + row-level errors/skips).
-- Additive. Safe to re-run.

create table if not exists crm_import_runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  pipeline_id     uuid references crm_pipelines(id) on delete set null,
  pipeline_nome   text not null,
  file_name       text,
  created_count   int not null default 0,
  skipped_count   int not null default 0,
  error_count     int not null default 0,
  matched_cnpjs   int not null default 0,
  list_id         uuid,
  qualified       int not null default 0,
  issues          jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists crm_import_runs_user_idx
  on crm_import_runs (user_id, created_at desc);

alter table crm_import_runs enable row level security;

drop policy if exists crm_import_runs_own on crm_import_runs;
create policy crm_import_runs_own on crm_import_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
