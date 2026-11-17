-- Day goal splits into discagens and contacts with the decision-maker.
-- Each classified attempt is its own row: a second dial to the same CNPJ counts.

alter table profiles
  add column if not exists meta_decisor_dia int;

alter table call_events
  add column if not exists outcome text not null default 'discagem';

alter table call_events drop constraint if exists call_events_outcome_check;
alter table call_events add constraint call_events_outcome_check
  check (outcome in ('discagem', 'decisor'));

alter table call_events drop constraint if exists call_events_user_id_cnpj_day_sp_key;
