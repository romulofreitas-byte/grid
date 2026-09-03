import { getCatalogItem, isBilledPlanSku } from "@/lib/billing/catalog";

export type OpsCohort = "active" | "trial" | "free";

export type OpsUserSnapshot = {
  livePlan: string | null;
  liveStatus: string | null;
  cachedPlan: string | null;
  activated: boolean;
};

export function classifyOpsCohort(input: {
  livePlan: string | null;
  liveStatus: string | null;
}): OpsCohort {
  if (input.liveStatus === "active" && isBilledPlanSku(input.livePlan)) {
    return "active";
  }
  if (
    input.liveStatus === "trialing" &&
    input.livePlan === "membro_plataforma"
  ) {
    return "trial";
  }
  return "free";
}

export function effectivePlanSku(input: OpsUserSnapshot): string {
  const cohort = classifyOpsCohort(input);
  if (cohort === "active" || cohort === "trial") {
    return input.livePlan ?? "free";
  }
  return input.cachedPlan?.trim() || "free";
}

export function mrrCentsForPlan(sku: string): number {
  const item = getCatalogItem(sku);
  if (!item || item.kind !== "plan" || !item.billed) return 0;
  return item.priceCents;
}

export function aggregateOpsCohorts(users: OpsUserSnapshot[]): {
  users: number;
  active: number;
  trial: number;
  free: number;
  activated: number;
  byPlan: Record<string, number>;
  mrrCents: number;
} {
  const byPlan: Record<string, number> = {};
  let active = 0;
  let trial = 0;
  let free = 0;
  let activated = 0;
  let mrrCents = 0;
  for (const user of users) {
    const cohort = classifyOpsCohort(user);
    if (cohort === "active") active += 1;
    else if (cohort === "trial") trial += 1;
    else free += 1;
    if (user.activated) activated += 1;
    const plan = effectivePlanSku(user);
    byPlan[plan] = (byPlan[plan] ?? 0) + 1;
    if (cohort === "active") mrrCents += mrrCentsForPlan(plan);
  }
  return {
    users: users.length,
    active,
    trial,
    free,
    activated,
    byPlan,
    mrrCents,
  };
}
