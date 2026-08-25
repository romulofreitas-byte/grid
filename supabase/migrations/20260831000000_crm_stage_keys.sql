-- Canonical keys on CRM stages + Descartado faixa.
-- Additive. Safe to re-run.

alter table crm_stages
  add column if not exists canonical_key text;

create unique index if not exists crm_stages_pipeline_canonical_uidx
  on crm_stages (pipeline_id, canonical_key)
  where canonical_key is not null;

update crm_stages
   set canonical_key = 'entrada'
 where canonical_key is null
   and lower(trim(nome)) = 'entrada de lista';

update crm_stages
   set canonical_key = 'tentando_contato'
 where canonical_key is null
   and lower(trim(nome)) = 'tentando contato';

update crm_stages
   set canonical_key = 'contato_respondido'
 where canonical_key is null
   and lower(trim(nome)) = 'contato respondido';

update crm_stages
   set canonical_key = 'followup_decisor'
 where canonical_key is null
   and lower(trim(nome)) = 'follow up decisor';

update crm_stages
   set canonical_key = 'reuniao_agendada'
 where canonical_key is null
   and lower(trim(nome)) = 'reunião agendada';

update crm_stages
   set canonical_key = 'reuniao_realizada'
 where canonical_key is null
   and lower(trim(nome)) = 'reunião realizada (r1)';

update crm_stages
   set canonical_key = 'ajustando_proposta'
 where canonical_key is null
   and lower(trim(nome)) = 'ajustando proposta';

update crm_stages
   set canonical_key = 'proposta_apresentada'
 where canonical_key is null
   and lower(trim(nome)) = 'proposta apresentada (r2)';

update crm_stages
   set canonical_key = 'negociacao'
 where canonical_key is null
   and lower(trim(nome)) = 'negociação e fechamento';

update crm_stages
   set canonical_key = 'contrato_fechado'
 where canonical_key is null
   and lower(trim(nome)) = 'contrato fechado';

update crm_stages
   set canonical_key = 'descartado'
 where canonical_key is null
   and lower(trim(nome)) = 'descartado';

do $$
declare
  pid uuid;
  leftover_keys text[];
  leftover_ids uuid[];
  i int;
  all_keys text[] := array[
    'entrada',
    'tentando_contato',
    'contato_respondido',
    'followup_decisor',
    'reuniao_agendada',
    'reuniao_realizada',
    'ajustando_proposta',
    'proposta_apresentada',
    'negociacao',
    'contrato_fechado'
  ];
begin
  for pid in select id from crm_pipelines loop
    select coalesce(array_agg(k), '{}')
      into leftover_keys
      from unnest(all_keys) as k
     where not exists (
       select 1 from crm_stages s
        where s.pipeline_id = pid and s.canonical_key = k
     );

    select coalesce(array_agg(id order by position, created_at), '{}')
      into leftover_ids
      from crm_stages
     where pipeline_id = pid and canonical_key is null;

    if array_length(leftover_keys, 1) is distinct from array_length(leftover_ids, 1) then
      continue;
    end if;
    if leftover_keys is null or leftover_ids is null then
      continue;
    end if;
    if array_length(leftover_keys, 1) is null then
      continue;
    end if;

    for i in 1 .. array_length(leftover_keys, 1) loop
      update crm_stages
         set canonical_key = leftover_keys[i]
       where id = leftover_ids[i];
    end loop;
  end loop;
end $$;

insert into crm_stages (pipeline_id, nome, position, canonical_key)
select p.id,
       'Descartado',
       coalesce(
         (select max(s.position) from crm_stages s where s.pipeline_id = p.id),
         -1
       ) + 1,
       'descartado'
  from crm_pipelines p
 where not exists (
   select 1 from crm_stages s
    where s.pipeline_id = p.id and s.canonical_key = 'descartado'
 );
