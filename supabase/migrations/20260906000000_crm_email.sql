-- E-mail as a schedulable activity / history kind.

alter table crm_activities drop constraint if exists crm_activities_kind_chk;
alter table crm_activities
  add constraint crm_activities_kind_chk
  check (kind in (
    'ligar', 'whatsapp', 'email', 'reuniao', 'followup', 'proposta', 'nota'
  ));

alter table crm_events drop constraint if exists crm_events_kind_chk;
alter table crm_events
  add constraint crm_events_kind_chk
  check (kind in (
    'ligar', 'whatsapp', 'email', 'reuniao', 'followup', 'proposta', 'nota', 'outcome'
  ));
