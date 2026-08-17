-- GRID RF tables for vanilla Postgres (Docker / Neon / Railway).
-- No auth.users, no RLS. Apply via docker-entrypoint or pnpm ingest.

create extension if not exists pg_trgm;

create table if not exists companies (
  cnpj_basico     char(8) primary key,
  razao_social    text not null,
  natureza_id     int,
  qualificacao_responsavel int,
  capital_social  numeric(18,2),
  porte           char(2),
  updated_at      timestamptz default now()
);

create table if not exists establishments (
  cnpj              char(14) primary key,
  cnpj_basico       char(8) not null references companies(cnpj_basico),
  is_matriz         boolean not null,
  nome_fantasia     text,
  situacao          char(2) not null,
  data_situacao     date,
  data_inicio       date,
  cnae_principal    char(7) not null,
  cnae_secundarios  text[],
  logradouro        text,
  numero            text,
  complemento       text,
  bairro            text,
  cep               char(8),
  uf                char(2) not null,
  municipio_id      int not null,
  ddd1              varchar(4),
  telefone1         varchar(10),
  ddd2              varchar(4),
  telefone2         varchar(10),
  email             text,
  updated_at        timestamptz default now()
);

create table if not exists partners (
  id                bigserial primary key,
  cnpj_basico       char(8) not null references companies(cnpj_basico),
  nome              text not null,
  qualificacao_id   int not null,
  data_entrada      date,
  faixa_etaria      smallint
);

create table if not exists simples_nacional (
  cnpj_basico     char(8) primary key references companies(cnpj_basico),
  opcao_simples   boolean,
  opcao_mei       boolean
);

create table if not exists ref_cnae         (codigo char(7) primary key, descricao text not null);
create table if not exists ref_municipio    (id int primary key, nome text not null, uf char(2));
create table if not exists ref_natureza     (id int primary key, descricao text not null);
create table if not exists ref_qualificacao (id int primary key, descricao text not null);

create table if not exists ingest_runs (
  id          uuid primary key default gen_random_uuid(),
  arquivo     text not null,
  linhas      int,
  duracao_ms  int,
  hash        text,
  created_at  timestamptz default now()
);

create materialized view if not exists phone_usage as
select ddd1, telefone1, count(distinct cnpj_basico)::int as qtd_empresas
from establishments
where telefone1 is not null and length(telefone1) >= 8
group by 1, 2;

create unique index if not exists phone_usage_uq on phone_usage (ddd1, telefone1);

create materialized view if not exists email_usage as
select lower(email) as email, count(distinct cnpj_basico)::int as qtd_empresas
from establishments
where email is not null and email like '%@%'
group by 1;

create unique index if not exists email_usage_uq on email_usage (email);

create materialized view if not exists address_usage as
select cep, logradouro, numero, count(distinct cnpj_basico)::int as qtd_empresas
from establishments
where cep is not null and numero is not null
group by 1, 2, 3;

create unique index if not exists address_usage_uq on address_usage (cep, logradouro, numero);

drop materialized view if exists phone_shared_verdict;
create materialized view phone_shared_verdict as
with phone_cnpjs as (
  select e.ddd1, e.telefone1, e.cnpj_basico
  from establishments e
  where e.telefone1 is not null and length(e.telefone1) >= 8
  group by 1, 2, 3
),
partner_hits as (
  select
    pc.ddd1,
    pc.telefone1,
    lower(regexp_replace(p.nome, '\s+', ' ', 'g')) as nome_n,
    count(distinct pc.cnpj_basico) as cnpjs_com_mesmo_socio
  from phone_cnpjs pc
  join partners p on p.cnpj_basico = pc.cnpj_basico
  group by 1, 2, 3
),
overlap as (
  select ddd1, telefone1, max(cnpjs_com_mesmo_socio) as max_overlap
  from partner_hits
  group by 1, 2
)
select
  u.ddd1,
  u.telefone1,
  u.qtd_empresas,
  case
    when u.qtd_empresas < 3 then 'proprio'
    when u.qtd_empresas > 50 then 'contabilidade'
    when coalesce(o.max_overlap, 0) >= 3
         and coalesce(o.max_overlap, 0)::numeric / nullif(u.qtd_empresas, 0) >= 0.4
      then 'grupo_economico'
    else 'contabilidade'
  end as verdict
from phone_usage u
left join overlap o on o.ddd1 = u.ddd1 and o.telefone1 = u.telefone1;

create unique index if not exists phone_shared_verdict_uq
  on phone_shared_verdict (ddd1, telefone1);

create materialized view if not exists cnae_uf_count as
select cnae_principal, uf, count(*)::int as n
from establishments
group by 1, 2
with no data;

create unique index if not exists cnae_uf_count_uq on cnae_uf_count (cnae_principal, uf);
