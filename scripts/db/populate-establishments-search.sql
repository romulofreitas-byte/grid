-- Rebuild establishments_search from RF tables + MVs.
-- Chunked runner: pnpm db:populate-search (preferred on Supabase).
-- This file is the full rebuild used by ingest after MV refresh.

set statement_timeout = 0;

drop index if exists idx_es_cnae_uf_mun;
drop index if exists idx_es_uf_mun_cnae;
drop index if exists idx_es_basico;
drop index if exists idx_es_matriz;
drop index if exists idx_es_fantasia;
drop index if exists idx_es_razao;

create unlogged table if not exists _es_partner_basicos (
  cnpj_basico char(8) primary key
);
truncate _es_partner_basicos;
insert into _es_partner_basicos
select distinct cnpj_basico from partners;

truncate establishments_search;

insert into establishments_search (
  cnpj,
  cnpj_basico,
  razao_social,
  nome_fantasia,
  cnae_principal,
  uf,
  municipio_id,
  is_matriz,
  data_inicio,
  porte,
  capital_social,
  opcao_simples,
  telefone1,
  ddd1,
  email,
  phone_verdict,
  email_livre,
  email_proprio,
  endereco_compartilhado,
  tem_decisor,
  opted_out
)
select
  e.cnpj,
  e.cnpj_basico,
  c.razao_social,
  e.nome_fantasia,
  e.cnae_principal,
  e.uf,
  e.municipio_id,
  e.is_matriz,
  e.data_inicio,
  c.porte,
  c.capital_social,
  coalesce(s.opcao_simples, false),
  e.telefone1,
  e.ddd1,
  e.email,
  coalesce(pv.verdict, 'proprio'),
  (
    e.email is not null
    and e.email like '%@%'
    and (
      lower(split_part(e.email, '@', 2)) like '%gmail%'
      or lower(split_part(e.email, '@', 2)) like '%hotmail%'
      or lower(split_part(e.email, '@', 2)) like '%outlook%'
      or lower(split_part(e.email, '@', 2)) like '%yahoo%'
      or lower(split_part(e.email, '@', 2)) like '%uol%'
      or lower(split_part(e.email, '@', 2)) like '%bol%'
      or lower(split_part(e.email, '@', 2)) like '%terra%'
      or lower(split_part(e.email, '@', 2)) like '%ig.com%'
      or lower(split_part(e.email, '@', 2)) like '%live.com%'
    )
  ),
  (
    e.email is not null
    and e.email like '%@%'
    and not (
      lower(split_part(e.email, '@', 2)) like '%gmail%'
      or lower(split_part(e.email, '@', 2)) like '%hotmail%'
      or lower(split_part(e.email, '@', 2)) like '%outlook%'
      or lower(split_part(e.email, '@', 2)) like '%yahoo%'
      or lower(split_part(e.email, '@', 2)) like '%uol%'
      or lower(split_part(e.email, '@', 2)) like '%bol%'
      or lower(split_part(e.email, '@', 2)) like '%terra%'
      or lower(split_part(e.email, '@', 2)) like '%ig.com%'
      or lower(split_part(e.email, '@', 2)) like '%live.com%'
    )
    and lower(split_part(e.email, '@', 2)) not similar to '%(contab|contabil|assessoria|escritorio|fiscal|tributar)%'
  ),
  coalesce(au.qtd_empresas, 0) >= 5,
  pb.cnpj_basico is not null,
  exists (
    select 1 from opt_outs o
    where o.documento in (e.cnpj, e.cnpj_basico)
  )
from establishments e
inner join companies c on c.cnpj_basico = e.cnpj_basico
left join simples_nacional s on s.cnpj_basico = e.cnpj_basico
left join phone_shared_verdict pv
  on pv.ddd1 = e.ddd1 and pv.telefone1 = e.telefone1
left join address_usage au
  on au.cep = e.cep
 and au.logradouro = e.logradouro
 and au.numero = e.numero
left join _es_partner_basicos pb on pb.cnpj_basico = e.cnpj_basico;

create index if not exists idx_es_cnae_uf_mun
  on establishments_search (cnae_principal, uf, municipio_id);
create index if not exists idx_es_uf_mun_cnae
  on establishments_search (uf, municipio_id, cnae_principal);
create index if not exists idx_es_basico
  on establishments_search (cnpj_basico);
create index if not exists idx_es_matriz
  on establishments_search (is_matriz)
  where is_matriz;
create index if not exists idx_es_fantasia
  on establishments_search using gin (nome_fantasia gin_trgm_ops);
create index if not exists idx_es_razao
  on establishments_search using gin (razao_social gin_trgm_ops);

analyze establishments_search;
drop table if exists _es_partner_basicos;
