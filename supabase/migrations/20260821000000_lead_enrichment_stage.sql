-- Progressive qualification: partial slices stream to the ficha.
-- Legacy rows without a stage are treated as complete.
alter table lead_enrichment
  add column if not exists stage text not null default 'complete';
