-- Cockpit do Piloto: identity for Minuto de Ouro + call habit tracking

alter table profiles add column if not exists foto_url text;
alter table profiles add column if not exists como_chama text;
alter table profiles add column if not exists tratamento text;
alter table profiles add column if not exists promessa text;
alter table profiles add column if not exists duracao_reuniao int not null default 20;
alter table profiles add column if not exists meta_ligacoes_dia int not null default 20;
alter table profiles add column if not exists onboarding_completed_at timestamptz;

alter table profiles drop constraint if exists profiles_tratamento_check;
alter table profiles add constraint profiles_tratamento_check
  check (tratamento is null or tratamento in ('o', 'a', 'e'));

create table if not exists call_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  cnpj           char(14) not null,
  saved_lead_id  uuid references saved_leads(id) on delete set null,
  source         text not null check (source in ('status', 'dialer', 'manual')),
  created_at     timestamptz not null default now(),
  day_sp         date not null default (timezone('America/Sao_Paulo', now())::date),
  unique (user_id, cnpj, day_sp)
);
create index if not exists call_events_user_day_idx
  on call_events (user_id, created_at desc);

alter table call_events enable row level security;

drop policy if exists "call_events_own" on call_events;
create policy "call_events_own" on call_events
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public)
    values ('avatars', 'avatars', true)
    on conflict (id) do nothing;
  end if;
end $$;
