-- Partial index matching the default Largada filters
-- (opted_out = false AND phone_verdict is distinct from 'contabilidade').
-- Lets count/runSearch use (cnae, uf, município) without filtering
-- contabilidade rows after a full index scan.

set statement_timeout = 0;

create index if not exists idx_es_active_cnae_uf_mun
  on establishments_search (cnae_principal, uf, municipio_id)
  where opted_out = false
    and phone_verdict is distinct from 'contabilidade';
