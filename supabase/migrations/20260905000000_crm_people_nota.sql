-- People on deals (name/phone/email) + nota as a schedulable activity kind.

alter table crm_deals
  add column if not exists people jsonb not null default '[]'::jsonb;

update crm_deals
   set people =
     jsonb_build_array(
       jsonb_build_object(
         'name', coalesce(contact_name, ''),
         'phone', '',
         'email', ''
       )
     )
     || coalesce(
       (
         select jsonb_agg(
           jsonb_build_object('name', trim(s), 'phone', '', 'email', '')
           order by ord
         )
         from jsonb_array_elements_text(secretaries) with ordinality as t(s, ord)
         where trim(s) <> ''
       ),
       '[]'::jsonb
     )
 where people = '[]'::jsonb
   and (
     coalesce(contact_name, '') <> ''
     or jsonb_typeof(secretaries) = 'array'
        and jsonb_array_length(secretaries) > 0
   );

alter table crm_activities drop constraint if exists crm_activities_kind_chk;
alter table crm_activities
  add constraint crm_activities_kind_chk
  check (kind in ('ligar', 'whatsapp', 'reuniao', 'followup', 'proposta', 'nota'));
