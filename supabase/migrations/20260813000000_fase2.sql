-- GRID Fase 2 — additive only. Do not alter Fase 0/1 tables except searches.saved.

alter table searches add column if not exists saved boolean not null default false;

create table if not exists lead_enrichment (
  cnpj           char(14) primary key,
  domain         text,
  domain_status  text not null default 'nao_encontrado',
  http_status    int,
  phones         jsonb not null default '[]',
  emails         jsonb not null default '[]',
  whatsapp       text,
  socials        jsonb not null default '{}',
  tech           jsonb not null default '{}',
  freshness      jsonb not null default '{}',
  osm            jsonb,
  dor_digital    int,
  contexto       text[] not null default '{}',
  fonte          jsonb not null default '{}',
  collected_at   timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '30 days')
);
create index if not exists lead_enrichment_expires_idx on lead_enrichment (expires_at);

create table if not exists enrichment_jobs (
  id           bigserial primary key,
  cnpj         char(14) not null,
  requested_by uuid references auth.users(id) on delete set null,
  search_id    uuid references searches(id) on delete cascade,
  status       text not null default 'pending',
  attempts     int not null default 0,
  last_error   text,
  locked_at    timestamptz,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index if not exists enrichment_jobs_status_idx on enrichment_jobs (status, created_at);
create index if not exists enrichment_jobs_search_idx on enrichment_jobs (search_id);
create unique index if not exists enrichment_jobs_active_cnpj
  on enrichment_jobs (cnpj) where status in ('pending', 'running');

create table if not exists domain_cache (
  cnpj_basico  char(8) primary key,
  domain       text,
  status       text not null,
  resolved_at  timestamptz not null default now()
);

-- Shared phone: accounting vs economic group (partners overlap).
create materialized view if not exists phone_shared_verdict as
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
    when coalesce(o.max_overlap, 0) >= 2 then 'grupo_economico'
    else 'contabilidade'
  end as verdict
from phone_usage u
left join overlap o on o.ddd1 = u.ddd1 and o.telefone1 = u.telefone1;

create unique index if not exists phone_shared_verdict_uq
  on phone_shared_verdict (ddd1, telefone1);

alter table lead_enrichment enable row level security;
alter table domain_cache enable row level security;
alter table enrichment_jobs enable row level security;

create policy "lead_enrichment_read" on lead_enrichment
  for select to authenticated using (true);

create policy "domain_cache_read" on domain_cache
  for select to authenticated using (true);

create policy "enrichment_jobs_own" on enrichment_jobs
  for select to authenticated using (requested_by = auth.uid());

-- Profile auto-create on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
