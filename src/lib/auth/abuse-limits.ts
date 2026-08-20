import { getBalance } from "@/lib/billing/service";
import type { PlanSku } from "@/lib/billing/catalog";
import { hasLiveDatabase } from "@/lib/data";
import { isUndefinedTableError, query } from "@/lib/data/pg";

export type DailyRunSearchLimit = {
  ok: boolean;
  used: number;
  limit: number;
  plano: PlanSku | string;
};

const DAILY_RUN_SEARCH: Record<string, number> = {
  free: 5,
  piloto: 30,
  membro_plataforma: 30,
  piloto_pro: 60,
  escuderia: 100,
};

const memoryDaily = new Map<string, { count: number; dayKey: string }>();

function saoPauloDayKey(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function dailyRunSearchCap(plano: string): number {
  return DAILY_RUN_SEARCH[plano] ?? DAILY_RUN_SEARCH.free;
}

async function readDailyCount(userId: string, bucket: string): Promise<number> {
  const dayKey = saoPauloDayKey();
  if (!hasLiveDatabase()) {
    const hit = memoryDaily.get(`${userId}:${bucket}`);
    if (!hit || hit.dayKey !== dayKey) return 0;
    return hit.count;
  }
  try {
    const { rows } = await query<{ count: number }>(
      `select count from usage_daily
       where user_id = $1 and bucket = $2 and day_sp = $3::date`,
      [userId, bucket, dayKey],
    );
    return Number(rows[0]?.count ?? 0);
  } catch (err) {
    if (!isUndefinedTableError(err)) throw err;
    const hit = memoryDaily.get(`${userId}:${bucket}`);
    if (!hit || hit.dayKey !== dayKey) return 0;
    return hit.count;
  }
}

async function incrementDailyCount(userId: string, bucket: string): Promise<number> {
  const dayKey = saoPauloDayKey();
  if (!hasLiveDatabase()) {
    const key = `${userId}:${bucket}`;
    const hit = memoryDaily.get(key);
    const count =
      !hit || hit.dayKey !== dayKey ? 1 : hit.count + 1;
    memoryDaily.set(key, { count, dayKey });
    return count;
  }
  try {
    const { rows } = await query<{ count: number }>(
      `insert into usage_daily (user_id, bucket, day_sp, count)
       values ($1, $2, $3::date, 1)
       on conflict (user_id, bucket, day_sp)
       do update set count = usage_daily.count + 1
       returning count`,
      [userId, bucket, dayKey],
    );
    return Number(rows[0]?.count ?? 1);
  } catch (err) {
    if (!isUndefinedTableError(err)) throw err;
    const key = `${userId}:${bucket}`;
    const hit = memoryDaily.get(key);
    const count = !hit || hit.dayKey !== dayKey ? 1 : hit.count + 1;
    memoryDaily.set(key, { count, dayKey });
    return count;
  }
}

/** Check before runSearch; does not increment. */
export async function checkDailyRunSearch(
  userId: string,
): Promise<DailyRunSearchLimit> {
  const balance = await getBalance(userId);
  const limit = dailyRunSearchCap(balance.plano);
  const used = await readDailyCount(userId, "run_search");
  return {
    ok: used < limit,
    used,
    limit,
    plano: balance.plano,
  };
}

/** Call after a successful runSearch. */
export async function recordDailyRunSearch(userId: string): Promise<number> {
  return incrementDailyCount(userId, "run_search");
}

export function resetAbuseLimitsForTests(): void {
  memoryDaily.clear();
}
