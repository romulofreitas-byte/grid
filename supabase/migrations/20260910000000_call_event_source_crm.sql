alter table call_events drop constraint if exists call_events_source_check;
alter table call_events add constraint call_events_source_check
  check (source in ('status', 'dialer', 'manual', 'crm'));
