import { PLANS } from "@/lib/billing/catalog";
import { OPS_EXCLUDED_EMAILS, OPS_EXCLUDED_NAMES } from "@/lib/ops/exclude";
import type { OpsDashboardFilters, OpsRange } from "@/lib/ops/filters";

export class SqlParams {
  values: unknown[] = [];

  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

const billedSkus = PLANS.filter((plan) => plan.billed).map((plan) => plan.sku);

function sqlStringList(values: string[]): string {
  return values.map((value) => `'${value.replace(/'/g, "''")}'`).join(", ");
}

export const LIVE_SUB_JOIN = `
  left join lateral (
    select s.plan, s.status, s.current_period_end, s.cancel_at_period_end
    from billing_subscriptions s
    where s.profile_id = p.id
      and s.status in ('active', 'trialing')
      and s.current_period_end > now()
    order by s.current_period_end desc
    limit 1
  ) live on true
`;

export function cohortExpr(
  plan = "live.plan",
  status = "live.status",
): string {
  return `case
    when ${status} = 'active' and ${plan} in (${sqlStringList(billedSkus)}) then 'active'
    when ${status} = 'trialing' and ${plan} = 'membro_plataforma' then 'trial'
    else 'free'
  end`;
}

export function effectivePlanExpr(
  livePlan = "live.plan",
  liveStatus = "live.status",
  cached = "p.plano",
): string {
  return `case
    when ${liveStatus} = 'active' and ${livePlan} in (${sqlStringList(billedSkus)}) then coalesce(${livePlan}, 'free')
    when ${liveStatus} = 'trialing' and ${livePlan} = 'membro_plataforma' then coalesce(${livePlan}, 'free')
    else coalesce(nullif(trim(${cached}), ''), 'free')
  end`;
}

export function mrrExpr(
  livePlan = "live.plan",
  liveStatus = "live.status",
): string {
  const whens = PLANS.filter((plan) => plan.billed)
    .map(
      (plan) =>
        `when ${liveStatus} = 'active' and ${livePlan} = '${plan.sku.replace(/'/g, "''")}' then ${plan.priceCents}`,
    )
    .join(" ");
  return `coalesce(case ${whens} else 0 end, 0)`;
}

/** Normalize a CNAE expression to 7 digits (Receita / char(7)). */
export function cnaeDigitsSql(expr: string): string {
  return `lpad(regexp_replace(${expr}, '[^0-9]', '', 'g'), 7, '0')`;
}

export function periodSql(column: string, range: OpsRange): string {
  if (range === "all") return "true";
  if (range === "today") {
    return `${column} >= (date_trunc('day', timezone('America/Sao_Paulo', now())) at time zone 'America/Sao_Paulo')`;
  }
  if (range === "month") {
    return `${column} >= (date_trunc('month', timezone('America/Sao_Paulo', now())) at time zone 'America/Sao_Paulo')`;
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return `${column} >= now() - interval '${days} days'`;
}

export function seriesStartSql(range: OpsRange): string {
  const today = `(timezone('America/Sao_Paulo', now()))::date`;
  if (range === "today") return today;
  if (range === "7d") return `${today} - 6`;
  if (range === "30d") return `${today} - 29`;
  if (range === "90d") return `${today} - 89`;
  if (range === "month") {
    return `date_trunc('month', timezone('America/Sao_Paulo', now()))::date`;
  }
  return `${today} - 179`;
}

export function daysCte(range: OpsRange): string {
  return `days as (
    select generate_series(
      ${seriesStartSql(range)},
      (timezone('America/Sao_Paulo', now()))::date,
      interval '1 day'
    )::date as day
  )`;
}

export function testerExcludeSql(withEmail: boolean): string {
  const names = sqlStringList([...OPS_EXCLUDED_NAMES]);
  const emails = sqlStringList([...OPS_EXCLUDED_EMAILS]);
  const byName = `lower(trim(coalesce(p.nome, ''))) not in (${names})`;
  if (!withEmail) return byName;
  return `${byName}
    and not exists (
      select 1 from auth.users au
      where au.id = p.id
        and lower(au.email) in (${emails})
    )`;
}

function activityInPeriodSql(filters: OpsDashboardFilters): string | null {
  if (filters.range !== "today") return null;
  return `(
    exists (
      select 1 from searches s
      where s.user_id = p.id and ${periodSql("s.created_at", filters.range)}
    )
    or exists (
      select 1 from enrichment_jobs e
      where e.requested_by = p.id and ${periodSql("e.created_at", filters.range)}
    )
    or exists (
      select 1 from call_events c
      where c.user_id = p.id and ${periodSql("c.created_at", filters.range)}
    )
    or exists (
      select 1 from billing_orders o
      where o.profile_id = p.id
        and o.status = 'paid'
        and ${periodSql("o.paid_at", filters.range)}
    )
  )`;
}

function rechargedExistsSql(filters: OpsDashboardFilters): string {
  return `exists (
    select 1 from billing_orders o
    where o.profile_id = p.id
      and o.status = 'paid'
      and o.kind = 'credit_pack'
      and ${periodSql("o.paid_at", filters.range)}
  )`;
}

export function scopedUsersSql(
  filters: OpsDashboardFilters,
  params: SqlParams,
  opts?: { withEmail?: boolean },
): string {
  const where = ["true", testerExcludeSql(opts?.withEmail !== false)];

  if (filters.cohort) {
    where.push(`${cohortExpr()} = ${params.add(filters.cohort)}`);
  }
  if (filters.plan) {
    where.push(`${effectivePlanExpr()} = ${params.add(filters.plan)}`);
  }
  if (filters.uf) {
    where.push(`exists (
      select 1 from searches s
      where s.user_id = p.id
        and ${periodSql("s.created_at", filters.range)}
        and coalesce(s.filtros->'ufs', '[]'::jsonb) ? ${params.add(filters.uf)}
    )`);
  }
  if (filters.nicheId) {
    const niche = params.add(filters.nicheId);
    where.push(`exists (
      select 1
      from searches s
      cross join lateral jsonb_array_elements_text(
        coalesce(s.filtros->'segmentIds', '[]'::jsonb)
      ) seg(id)
      join niche_presets np on np.id::text = seg.id
      where s.user_id = p.id
        and ${periodSql("s.created_at", filters.range)}
        and (np.id::text = ${niche} or np.parent_id::text = ${niche})
    )`);
  }
  if (filters.recharged === true) {
    where.push(rechargedExistsSql(filters));
  }
  if (filters.recharged === false) {
    where.push(`not ${rechargedExistsSql(filters)}`);
  }
  const activity = activityInPeriodSql(filters);
  if (activity) where.push(activity);

  return `scoped_users as (
    select
      p.id,
      ${cohortExpr()} as cohort,
      ${effectivePlanExpr()} as plan,
      ${mrrExpr()} as mrr_cents,
      (p.onboarding_completed_at is not null) as activated,
      p.created_at,
      live.plan as live_plan,
      live.status as live_status,
      live.current_period_end as period_end,
      live.cancel_at_period_end,
      ${rechargedExistsSql(filters)} as recharged
    from profiles p
    ${LIVE_SUB_JOIN}
    where ${where.join("\n      and ")}
  )`;
}

export function beginScoped(
  filters: OpsDashboardFilters,
  opts?: { withEmail?: boolean },
): {
  params: SqlParams;
  cte: string;
} {
  const params = new SqlParams();
  return { params, cte: scopedUsersSql(filters, params, opts) };
}
