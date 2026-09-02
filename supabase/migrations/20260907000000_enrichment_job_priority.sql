-- Interactive qualify (10/20/50, seleção, ficha) jumps ahead of "lista inteira".
alter table enrichment_jobs
  add column if not exists priority smallint not null default 0;

create index if not exists enrichment_jobs_claim_idx
  on enrichment_jobs (priority desc, created_at)
  where status in ('pending', 'running');
