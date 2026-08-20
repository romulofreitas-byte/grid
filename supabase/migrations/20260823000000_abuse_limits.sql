-- Daily usage counters (run_search caps, future buckets).

create table if not exists usage_daily (
  user_id   uuid not null references profiles(id) on delete cascade,
  bucket    text not null,
  day_sp    date not null default (timezone('America/Sao_Paulo', now())::date),
  count     int  not null default 0,
  primary key (user_id, bucket, day_sp)
);

create index if not exists usage_daily_day_idx on usage_daily (day_sp, bucket);

comment on table usage_daily is
  'Per-user daily counters for abuse prevention (run_search, etc.).';

alter table usage_daily enable row level security;
