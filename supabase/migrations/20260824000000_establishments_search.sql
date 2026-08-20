-- Desnormalized search table — rebuilt after each RF ingest (see scripts/db/populate-establishments-search.sql).

create table if not exists establishments_search (
  cnpj                   char(14) primary key,
  cnpj_basico            char(8) not null,
  razao_social           text not null,
  nome_fantasia          text,
  cnae_principal         char(7) not null,
  uf                     char(2) not null,
  municipio_id           int not null,
  is_matriz              boolean not null default false,
  data_inicio            date,
  porte                  char(2),
  capital_social         numeric(18, 2),
  opcao_simples          boolean not null default false,
  telefone1              varchar(10),
  ddd1                   varchar(4),
  email                  text,
  phone_verdict          text not null default 'proprio',
  email_livre            boolean not null default false,
  email_proprio          boolean not null default false,
  endereco_compartilhado boolean not null default false,
  tem_decisor            boolean not null default false,
  opted_out              boolean not null default false
);

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
