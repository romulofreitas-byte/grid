import { suggestCrmRates, type CrmRateDeal, type CrmRateSuggestions } from "@/lib/calculadora/crm-rates";
import { getDataSource, hasLiveDatabase } from "@/lib/data";
import { getMockStore } from "@/lib/data/mock-store";
import { isUndefinedColumnError, isUndefinedTableError, query } from "@/lib/data/pg";

async function optionalQuery<T extends Record<string, unknown>>(
  text: string,
  params: unknown[],
): Promise<T[]> {
  try {
    const { rows } = await query<T>(text, params);
    return rows;
  } catch (err) {
    if (isUndefinedTableError(err) || isUndefinedColumnError(err)) return [];
    throw err;
  }
}

function mapDealRows(
  rows: Array<{
    canonical_key: string | null;
    outcome: string;
    amount_cents: number | null;
  }>,
): CrmRateDeal[] {
  return rows.map((row) => ({
    canonical_key: row.canonical_key,
    outcome: row.outcome === "won" || row.outcome === "lost" ? row.outcome : "open",
    amount_cents: row.amount_cents == null ? null : Number(row.amount_cents),
  }));
}

async function loadCrmDealsPg(userId: string): Promise<CrmRateDeal[]> {
  const dealRows = await optionalQuery<{
    canonical_key: string | null;
    outcome: string;
    amount_cents: number | null;
  }>(
    `select s.canonical_key, d.outcome, d.amount_cents
       from crm_deals d
       join crm_pipelines p on p.id = d.pipeline_id
       join crm_stages s on s.id = d.stage_id
      where p.user_id = $1`,
    [userId],
  );
  return mapDealRows(dealRows);
}

function loadCrmDealsMock(userId: string): CrmRateDeal[] {
  const store = getMockStore();
  const owned = new Set(
    store.crm_pipelines.filter((row) => row.user_id === userId).map((row) => row.id),
  );
  const stages = new Map(store.crm_stages.map((row) => [row.id, row]));
  return store.crm_deals
    .filter((row) => owned.has(row.pipeline_id))
    .map((row) => ({
      canonical_key: stages.get(row.stage_id)?.canonical_key ?? null,
      outcome: row.outcome,
      amount_cents: row.amount_cents,
    }));
}

export async function loadCrmSuggestions(
  userId: string,
): Promise<CrmRateSuggestions> {
  const deals =
    getDataSource() === "supabase" && hasLiveDatabase()
      ? await loadCrmDealsPg(userId)
      : loadCrmDealsMock(userId);
  return suggestCrmRates({ deals });
}
