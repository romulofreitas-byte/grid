-- Fast CRM deal autocomplete: trigram indexes for ILIKE '%term%'
-- plus a digits-only CNPJ btree. Safe to re-run.

create extension if not exists pg_trgm;

create index if not exists crm_deals_company_trgm_idx
  on crm_deals using gin (company_name gin_trgm_ops);

create index if not exists crm_deals_contact_trgm_idx
  on crm_deals using gin (contact_name gin_trgm_ops);

create index if not exists crm_deals_cnpj_idx
  on crm_deals (cnpj)
  where cnpj is not null and cnpj <> '';
