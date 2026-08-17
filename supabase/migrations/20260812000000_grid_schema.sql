-- GRID schema — Fases 0 e 1
-- Apply via Supabase SQL editor or `supabase db push` when credentials exist.

-- ============ BASE RECEITA FEDERAL ============

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
  -- CPF deliberately omitted
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

-- Indexes created AFTER bulk load by ingest pipeline (see scripts/ingest).
-- Listed here for documentation / apply after first load:
-- create index idx_est_search on establishments (uf, municipio_id, cnae_principal);
-- create index idx_est_cnae   on establishments (cnae_principal);
-- create index idx_est_basico on establishments (cnpj_basico);
-- create index idx_part_basico on partners (cnpj_basico);
-- create extension if not exists pg_trgm;
-- create index idx_comp_razao on companies using gin (razao_social gin_trgm_ops);
-- create index idx_est_fantasia on establishments using gin (nome_fantasia gin_trgm_ops);
-- create index idx_cnae_desc on ref_cnae using gin (descricao gin_trgm_ops);

-- ============ APLICAÇÃO ============

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text,
  plano       text not null default 'free',
  creditos    int  not null default 25,
  especialidade text,
  area          text,
  empresa_usuario text,
  cidade_usuario  text,
  created_at  timestamptz default now()
);

create table if not exists searches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nome        text not null,
  filtros     jsonb not null,
  total_found int,
  created_at  timestamptz default now()
);

create table if not exists saved_leads (
  id           uuid primary key default gen_random_uuid(),
  search_id    uuid not null references searches(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  cnpj         char(14) not null,
  grid_score   int,
  grid_position int,
  enrichment   jsonb,
  status       text default 'novo',
  notas        text,
  created_at   timestamptz default now(),
  unique (search_id, cnpj)
);

create table if not exists opt_outs (
  id          uuid primary key default gen_random_uuid(),
  documento   text not null unique,
  motivo      text,
  created_at  timestamptz default now()
);

create table if not exists ingest_runs (
  id          uuid primary key default gen_random_uuid(),
  arquivo     text not null,
  linhas      int,
  duracao_ms  int,
  hash        text,
  created_at  timestamptz default now()
);

-- ============ MOTOR DE CONFIANÇA ============

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

-- ============ PRESETS ============

create table if not exists niche_presets (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  nome         text not null,
  grupo        text not null,
  perfil_score text not null,
  parent_id    uuid references niche_presets(id) on delete cascade,
  keywords     text[] not null,
  exclusoes    text[] default '{}',
  name_stems   text[] default '{}',
  curado       boolean default false,
  ordem        int default 0
);

create table if not exists niche_preset_cnaes (
  preset_id  uuid not null references niche_presets(id) on delete cascade,
  cnae       char(7) not null,
  incluido   boolean not null default true,
  primary key (preset_id, cnae)
);

-- ============ RLS ============

alter table profiles enable row level security;
alter table searches enable row level security;
alter table saved_leads enable row level security;

create policy "profiles_own" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "searches_own" on searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "saved_leads_own" on saved_leads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RF tables: authenticated read (apply when auth is live)
-- grant select on companies, establishments, partners, simples_nacional,
--   ref_cnae, ref_municipio, ref_natureza, ref_qualificacao,
--   phone_usage, email_usage, address_usage to authenticated;
