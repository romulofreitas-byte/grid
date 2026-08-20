-- CRM v1: phones collected during the call.

alter table crm_deals
  add column if not exists phones jsonb not null default '[]'::jsonb;
