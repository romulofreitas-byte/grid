-- Phones the piloto hid on a company. Receita rows stay untouched.
-- Additive. Safe to re-run.

create table if not exists user_hidden_phones (
  user_id      uuid not null references profiles(id) on delete cascade,
  cnpj         char(14) not null,
  phone_digits text not null,
  created_at   timestamptz not null default now(),
  primary key (user_id, cnpj, phone_digits)
);

create index if not exists user_hidden_phones_user_cnpj_idx
  on user_hidden_phones (user_id, cnpj);

alter table user_hidden_phones enable row level security;

drop policy if exists user_hidden_phones_own on user_hidden_phones;
create policy user_hidden_phones_own on user_hidden_phones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
