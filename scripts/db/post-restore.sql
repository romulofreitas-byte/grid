-- Run on Supabase after restoring a Docker dump.
-- Do not wrap in an explicit transaction (some SQL editors do — disable it).

set statement_timeout = 0;

create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

create index if not exists idx_est_search on establishments (uf, municipio_id, cnae_principal);
create index if not exists idx_est_cnae on establishments (cnae_principal);
create index if not exists idx_est_basico on establishments (cnpj_basico);
create index if not exists idx_part_basico on partners (cnpj_basico);
create index if not exists idx_comp_razao on companies using gin (razao_social gin_trgm_ops);
create index if not exists idx_est_fantasia on establishments using gin (nome_fantasia gin_trgm_ops);
create index if not exists idx_cnae_desc on ref_cnae using gin (descricao gin_trgm_ops);

update opt_outs
set documento = regexp_replace(documento, '\D', '', 'g')
where documento ~ '\D';

create materialized view if not exists cnae_uf_count as
select cnae_principal, uf, count(*)::int as n
from establishments
group by 1, 2
with no data;

create unique index if not exists cnae_uf_count_uq on cnae_uf_count (cnae_principal, uf);

refresh materialized view phone_usage;
refresh materialized view email_usage;
refresh materialized view address_usage;
refresh materialized view phone_shared_verdict;
refresh materialized view cnae_uf_count;

create index if not exists idx_est_search on establishments (uf, municipio_id, cnae_principal);
create index if not exists idx_est_cnae on establishments (cnae_principal);
create index if not exists idx_est_basico on establishments (cnpj_basico);
create index if not exists idx_part_basico on partners (cnpj_basico);
create index if not exists idx_comp_razao on companies using gin (razao_social gin_trgm_ops);
create index if not exists idx_est_fantasia on establishments using gin (nome_fantasia gin_trgm_ops);
create index if not exists idx_cnae_desc on ref_cnae using gin (descricao gin_trgm_ops);

update opt_outs
set documento = regexp_replace(documento, '\D', '', 'g')
where documento ~ '\D';

refresh materialized view phone_usage;
refresh materialized view email_usage;
refresh materialized view address_usage;
refresh materialized view phone_shared_verdict;
refresh materialized view cnae_uf_count;
