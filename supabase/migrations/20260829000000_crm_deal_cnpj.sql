-- CRM bridge: CNPJ dedupe per pipeline + optional meta (local/lista).
-- Additive. Safe to re-run.

alter table crm_deals
  add column if not exists cnpj text,
  add column if not exists meta jsonb not null default '{}'::jsonb;

create unique index if not exists crm_deals_pipeline_cnpj_uidx
  on crm_deals (pipeline_id, cnpj)
  where cnpj is not null and length(trim(cnpj)) > 0;

create index if not exists crm_deals_cnpj_idx
  on crm_deals (cnpj)
  where cnpj is not null;
