-- Presence assets independent of a confirmed site, plus human confirm/reject jobs.
alter table lead_enrichment
  add column if not exists gmb jsonb,
  add column if not exists discarded_domains text[] not null default '{}';

alter table enrichment_jobs
  add column if not exists payload jsonb;
