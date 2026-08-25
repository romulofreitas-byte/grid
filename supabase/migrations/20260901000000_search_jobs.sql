-- Durable queue for runSearch so Vercel isolates do not stampede Postgres.

create table if not exists search_jobs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nome        text not null,
  filtros     jsonb not null,
  status      text not null default 'pending',
  search_id   uuid references searches(id) on delete set null,
  error       text,
  attempts    int not null default 0,
  locked_at   timestamptz,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists search_jobs_status_idx
  on search_jobs (status, created_at);

create index if not exists search_jobs_user_status_idx
  on search_jobs (user_id, status, created_at desc);

alter table search_jobs enable row level security;

drop policy if exists "search_jobs_own" on search_jobs;
create policy "search_jobs_own" on search_jobs
  for select to authenticated using (user_id = auth.uid());
