-- Missing from older dumps; required for Largada fast count.
set statement_timeout = 0;

create materialized view if not exists cnae_uf_count as
select cnae_principal, uf, count(*)::int as n
from establishments
group by 1, 2
with no data;

create unique index if not exists cnae_uf_count_uq on cnae_uf_count (cnae_principal, uf);

refresh materialized view cnae_uf_count;
