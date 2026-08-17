-- Assinantes Mundo Pódium (audience Circle). Populada via pnpm seed:platform-audience.

create table if not exists platform_subscribers (
  email        text primary key,
  imported_at  timestamptz not null default now()
);

create index if not exists platform_subscribers_imported_idx
  on platform_subscribers (imported_at desc);

comment on table platform_subscribers is
  'E-mails da audience Mundo Pódium. Usado para mostrar cupom Piloto no Box.';

alter table platform_subscribers enable row level security;

-- Leitura só via service role / DATABASE_URL no servidor (sem policy anon).
