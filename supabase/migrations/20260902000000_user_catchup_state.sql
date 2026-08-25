-- Per-user catch-up lock so session reconcile does not double-run.
-- Additive. Safe to re-run.

create table if not exists user_catchup_state (
  user_id     uuid not null references profiles(id) on delete cascade,
  task_id     text not null,
  status      text not null default 'idle',
  last_ran_at timestamptz,
  has_more    boolean not null default false,
  last_result jsonb not null default '{}'::jsonb,
  primary key (user_id, task_id),
  constraint user_catchup_status_chk check (status in ('idle', 'running'))
);

alter table user_catchup_state enable row level security;

drop policy if exists user_catchup_state_own on user_catchup_state;
create policy user_catchup_state_own on user_catchup_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
