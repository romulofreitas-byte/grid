-- GRID CRM — append-only activity history + deal outcome (won/lost).
-- Additive. Safe to re-run.

alter table crm_deals
  add column if not exists outcome text not null default 'open';

alter table crm_deals drop constraint if exists crm_deals_outcome_chk;
alter table crm_deals
  add constraint crm_deals_outcome_chk
  check (outcome in ('open', 'won', 'lost'));

create index if not exists crm_deals_outcome_idx
  on crm_deals (pipeline_id, outcome);

create table if not exists crm_events (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references crm_deals(id) on delete cascade,
  kind        text not null,
  body        text not null default '',
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint crm_events_kind_chk
    check (kind in (
      'ligar', 'whatsapp', 'reuniao', 'followup', 'proposta', 'nota', 'outcome'
    ))
);
create index if not exists crm_events_deal_idx
  on crm_events (deal_id, created_at desc);

alter table crm_events enable row level security;

drop policy if exists crm_events_own on crm_events;
create policy crm_events_own on crm_events
  for all using (
    exists (
      select 1
      from crm_deals d
      join crm_pipelines p on p.id = d.pipeline_id
      where d.id = deal_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from crm_deals d
      join crm_pipelines p on p.id = d.pipeline_id
      where d.id = deal_id and p.user_id = auth.uid()
    )
  );

insert into crm_events (deal_id, kind, body)
select id, 'nota', notes
  from crm_deals
 where length(trim(notes)) > 0
   and not exists (
     select 1 from crm_events e where e.deal_id = crm_deals.id
   );
