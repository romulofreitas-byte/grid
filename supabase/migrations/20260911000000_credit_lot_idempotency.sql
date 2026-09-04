-- Collapse duplicate credit lots, then unique-index period and order grants.

with period_ranked as (
  select
    l.id,
    l.profile_id,
    l.qty,
    l.remaining,
    row_number() over (
      partition by
        l.profile_id,
        l.source,
        date_trunc('month', l.expires_at at time zone 'UTC')
      order by l.created_at asc, l.id asc
    ) as rn,
    sum(l.qty - l.remaining) over (
      partition by
        l.profile_id,
        l.source,
        date_trunc('month', l.expires_at at time zone 'UTC')
    ) as spent
  from credit_lots l
  where l.order_id is null
    and l.expires_at is not null
    and l.source in ('plan_grant', 'platform')
),
period_keep as (
  select
    id,
    profile_id,
    remaining,
    greatest(0, qty - spent)::int as new_remaining
  from period_ranked
  where rn = 1
),
period_extras as (
  select id, profile_id, remaining
  from period_ranked
  where rn > 1
)
insert into credit_ledger (id, profile_id, type, amount, reason, ref, lot_id, created_at)
select gen_random_uuid(), k.profile_id, 'expire', k.remaining - k.new_remaining,
       'dedupe_period_grant', null, k.id, now()
from period_keep k
where k.remaining > k.new_remaining
union all
select gen_random_uuid(), e.profile_id, 'expire', e.remaining,
       'dedupe_period_grant', null, e.id, now()
from period_extras e
where e.remaining > 0;

with period_ranked as (
  select
    l.id,
    l.qty,
    row_number() over (
      partition by
        l.profile_id,
        l.source,
        date_trunc('month', l.expires_at at time zone 'UTC')
      order by l.created_at asc, l.id asc
    ) as rn,
    sum(l.qty - l.remaining) over (
      partition by
        l.profile_id,
        l.source,
        date_trunc('month', l.expires_at at time zone 'UTC')
    ) as spent
  from credit_lots l
  where l.order_id is null
    and l.expires_at is not null
    and l.source in ('plan_grant', 'platform')
)
update credit_lots l
set remaining = greatest(0, r.qty - r.spent)::int
from period_ranked r
where l.id = r.id
  and r.rn = 1
  and l.remaining is distinct from greatest(0, r.qty - r.spent)::int;

with period_ranked as (
  select
    l.id,
    row_number() over (
      partition by
        l.profile_id,
        l.source,
        date_trunc('month', l.expires_at at time zone 'UTC')
      order by l.created_at asc, l.id asc
    ) as rn
  from credit_lots l
  where l.order_id is null
    and l.expires_at is not null
    and l.source in ('plan_grant', 'platform')
)
delete from credit_lots l
using period_ranked r
where l.id = r.id
  and r.rn > 1;

with order_ranked as (
  select
    l.id,
    l.profile_id,
    l.qty,
    l.remaining,
    row_number() over (
      partition by l.order_id
      order by l.created_at asc, l.id asc
    ) as rn,
    sum(l.qty - l.remaining) over (partition by l.order_id) as spent
  from credit_lots l
  where l.order_id is not null
),
order_keep as (
  select
    id,
    profile_id,
    remaining,
    greatest(0, qty - spent)::int as new_remaining
  from order_ranked
  where rn = 1
),
order_extras as (
  select id, profile_id, remaining
  from order_ranked
  where rn > 1
)
insert into credit_ledger (id, profile_id, type, amount, reason, ref, lot_id, created_at)
select gen_random_uuid(), k.profile_id, 'expire', k.remaining - k.new_remaining,
       'dedupe_order_grant', null, k.id, now()
from order_keep k
where k.remaining > k.new_remaining
union all
select gen_random_uuid(), e.profile_id, 'expire', e.remaining,
       'dedupe_order_grant', null, e.id, now()
from order_extras e
where e.remaining > 0;

with order_ranked as (
  select
    l.id,
    l.qty,
    row_number() over (
      partition by l.order_id
      order by l.created_at asc, l.id asc
    ) as rn,
    sum(l.qty - l.remaining) over (partition by l.order_id) as spent
  from credit_lots l
  where l.order_id is not null
)
update credit_lots l
set remaining = greatest(0, r.qty - r.spent)::int
from order_ranked r
where l.id = r.id
  and r.rn = 1
  and l.remaining is distinct from greatest(0, r.qty - r.spent)::int;

with order_ranked as (
  select
    l.id,
    row_number() over (
      partition by l.order_id
      order by l.created_at asc, l.id asc
    ) as rn
  from credit_lots l
  where l.order_id is not null
)
delete from credit_lots l
using order_ranked r
where l.id = r.id
  and r.rn > 1;

update profiles p
set creditos = coalesce((
  select sum(l.remaining)::int
  from credit_lots l
  where l.profile_id = p.id
    and l.remaining > 0
    and (l.expires_at is null or l.expires_at > now())
), 0)
where exists (
  select 1 from credit_ledger e
  where e.profile_id = p.id
    and e.reason in ('dedupe_period_grant', 'dedupe_order_grant')
);

create unique index if not exists credit_lots_one_open_period
  on credit_lots (
    profile_id,
    source,
    (date_trunc('month', expires_at at time zone 'UTC'))
  )
  where order_id is null
    and remaining > 0
    and expires_at is not null
    and source in ('plan_grant', 'platform');

create unique index if not exists credit_lots_one_per_order
  on credit_lots (order_id)
  where order_id is not null;
