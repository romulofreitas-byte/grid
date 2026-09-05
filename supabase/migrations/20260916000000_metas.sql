-- Multiple funnel metas per pilot. One active_meta_id drives the Box ring.
-- Safe to re-run: IF NOT EXISTS / ON CONFLICT-style guards.

create table if not exists metas (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  created_by       uuid not null references profiles(id) on delete cascade,
  nome             text not null,
  tipo_empresa     text not null default '',
  meta_faturamento numeric not null default 0,
  ticket           numeric not null default 0,
  prazo_meses      int not null default 0,
  taxa1            numeric not null default 20,
  taxa2            numeric not null default 70,
  taxa3            numeric not null default 80,
  taxa4            numeric not null default 50,
  taxas_origem     text not null default 'padrao',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint metas_taxas_origem_chk
    check (taxas_origem in ('padrao', 'crm', 'manual'))
);

create index if not exists metas_user_idx
  on metas (user_id, updated_at desc);

alter table metas enable row level security;

drop policy if exists metas_own on metas;
create policy metas_own on metas
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table profiles
  add column if not exists active_meta_id uuid references metas(id) on delete set null;

insert into metas (
  user_id, created_by, nome, tipo_empresa,
  meta_faturamento, ticket, prazo_meses,
  taxa1, taxa2, taxa3, taxa4, taxas_origem
)
select
  p.id,
  p.id,
  'Meta atual',
  '',
  coalesce(nullif(p.funnel_plan->>'metaFaturamento', '')::numeric, 0),
  coalesce(nullif(p.funnel_plan->>'ticket', '')::numeric, 0),
  coalesce(nullif(p.funnel_plan->>'prazoMeses', '')::int, 0),
  coalesce(nullif(p.funnel_plan->>'taxa1', '')::numeric, 20),
  coalesce(nullif(p.funnel_plan->>'taxa2', '')::numeric, 70),
  coalesce(nullif(p.funnel_plan->>'taxa3', '')::numeric, 80),
  coalesce(nullif(p.funnel_plan->>'taxa4', '')::numeric, 50),
  case
    when p.funnel_plan->>'taxasOrigem' in ('padrao', 'crm', 'manual')
      then p.funnel_plan->>'taxasOrigem'
    else 'padrao'
  end
from profiles p
where p.funnel_plan is not null
  and jsonb_typeof(p.funnel_plan) = 'object'
  and (
    coalesce(nullif(p.funnel_plan->>'metaFaturamento', '')::numeric, 0) > 0
    or coalesce(nullif(p.funnel_plan->>'ticket', '')::numeric, 0) > 0
    or coalesce(nullif(p.funnel_plan->>'prazoMeses', '')::int, 0) > 0
    or nullif(trim(p.funnel_plan->>'appliedAt'), '') is not null
  )
  and not exists (select 1 from metas m where m.user_id = p.id);

update profiles p
set active_meta_id = m.id
from (
  select distinct on (user_id) id, user_id
  from metas
  order by user_id, created_at asc
) m
where m.user_id = p.id
  and p.active_meta_id is null
  and p.funnel_plan is not null
  and nullif(trim(p.funnel_plan->>'appliedAt'), '') is not null;
