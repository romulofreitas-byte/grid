-- Names the user deleted, so qualify and catch-up do not rebuild that nicho.
-- Additive. Safe to re-run.

create table if not exists crm_pipeline_name_blocks (
  user_id    uuid not null references profiles(id) on delete cascade,
  nome_key   text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, nome_key)
);

alter table crm_pipeline_name_blocks enable row level security;

drop policy if exists crm_pipeline_name_blocks_own on crm_pipeline_name_blocks;
create policy crm_pipeline_name_blocks_own on crm_pipeline_name_blocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
