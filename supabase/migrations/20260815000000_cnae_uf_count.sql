-- Additive CNAE×UF counts for Largada niche volumes / typeahead.
-- Does not alter RF row data; refresh during ingest with the other MVs.

create materialized view if not exists cnae_uf_count as
select cnae_principal, uf, count(*)::int as n
from establishments
group by 1, 2
with no data;

create unique index if not exists cnae_uf_count_uq on cnae_uf_count (cnae_principal, uf);
