-- Recalibrate grupo vs contabilidade: large clusters and weak name
-- collisions are accounting. Real groups need overlap in ≥3 CNPJs covering
-- ≥40% of a cluster of at most 50.

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
