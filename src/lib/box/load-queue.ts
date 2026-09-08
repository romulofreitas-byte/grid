import { getBalance } from "@/lib/billing/service";
import {
  boxQueueCounts,
  buildBoxQueue,
  emptyBoxQueue,
  isBoxQueueKind,
  type BoxQueue,
  type BoxQueuePayload,
  type BoxQueueSource,
} from "@/lib/box/queue";
import { buildBoxRhythm, type BoxRhythm } from "@/lib/box/rhythm";
import { isCrmStageKey } from "@/lib/crm/cadence";
import { uniquePhones } from "@/lib/crm/dial";
import { peopleFromDeal } from "@/lib/crm/people";
import type { CrmOutcome } from "@/lib/crm/types";
import { getDataSource, hasLiveDatabase } from "@/lib/data";
import { getMockStore } from "@/lib/data/mock-store";
import { isUndefinedColumnError, isUndefinedTableError, query } from "@/lib/data/pg";
import { DEFAULT_CALL_GOAL } from "@/lib/pilot-profile";

export class BoxQueueError extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = "BoxQueueError";
    this.status = status;
  }
}

function emptyQueue(): BoxQueue {
  return emptyBoxQueue();
}

function asIso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function mapOutcome(value: unknown): CrmOutcome {
  return value === "won" || value === "lost" ? value : "open";
}

function searchIdFromMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const id = (meta as { searchId?: unknown }).searchId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function phonesFromDeal(row: {
  contact_name: unknown;
  secretaries: unknown;
  people: unknown;
  phones: unknown;
}): string[] {
  const people = peopleFromDeal({
    contact_name: String(row.contact_name ?? ""),
    secretaries: asStringList(row.secretaries),
    people: row.people,
  });
  return uniquePhones([
    ...asStringList(row.phones),
    ...people.map((person) => person.phone),
  ]);
}

async function optionalQuery<T extends Record<string, unknown>>(
  text: string,
  params: unknown[],
): Promise<T[]> {
  try {
    const { rows } = await query<T>(text, params);
    return rows;
  } catch (err) {
    if (isUndefinedTableError(err) || isUndefinedColumnError(err)) {
      console.error("box_optional_query_missing", err);
      return [];
    }
    throw err;
  }
}

type BoxQueueIdle = {
  openDealCount: number;
  openOtherActivityCount: number;
};

function emptyIdle(): BoxQueueIdle {
  return { openDealCount: 0, openOtherActivityCount: 0 };
}

function toPayload(
  queue: BoxQueue,
  flags: { crmAllowed: boolean; trialExpired: boolean },
  rhythm: BoxRhythm,
  idle: BoxQueueIdle,
): BoxQueuePayload {
  return {
    crmAllowed: flags.crmAllowed,
    trialExpired: flags.trialExpired,
    overdue: queue.overdue,
    today: queue.today,
    tomorrow: queue.tomorrow,
    week: queue.week,
    later: queue.later,
    counts: boxQueueCounts(queue),
    rhythm,
    openDealCount: idle.openDealCount,
    openOtherActivityCount: idle.openOtherActivityCount,
  };
}

async function loadSourcesPg(userId: string): Promise<BoxQueueSource[]> {
  const { rows } = await query<{
    activity_id: string;
    kind: string;
    due_at: string;
    status: string;
    deal_id: string;
    company_name: string;
    contact_name: string;
    cnpj: string | null;
    phones: unknown;
    people: unknown;
    secretaries: unknown;
    outcome: string;
    meta: unknown;
    pipeline_id: string;
    stage_nome: string;
    canonical_key: string | null;
    pipeline_nome: string;
    notes: string | null;
  }>(
    `select a.id as activity_id, a.kind, a.due_at, a.status,
            d.id as deal_id, d.company_name, d.contact_name, d.cnpj,
            d.phones, d.people, d.secretaries, d.outcome, d.meta, d.pipeline_id,
            d.notes,
            s.nome as stage_nome, s.canonical_key,
            p.nome as pipeline_nome
       from crm_activities a
       join crm_deals d on d.id = a.deal_id
       join crm_pipelines p on p.id = d.pipeline_id
       join crm_stages s on s.id = d.stage_id
      where p.user_id = $1
        and a.status = 'open'
        and d.outcome = 'open'
        and a.kind in ('ligar', 'whatsapp')`,
    [userId],
  );

  return rows.map((row) => ({
    activityId: String(row.activity_id),
    dealId: String(row.deal_id),
    pipelineId: String(row.pipeline_id),
    pipelineNome: String(row.pipeline_nome),
    companyName: String(row.company_name),
    contactName: String(row.contact_name ?? ""),
    cnpj: row.cnpj == null || row.cnpj === "" ? null : String(row.cnpj),
    searchId: searchIdFromMeta(row.meta),
    phones: phonesFromDeal(row),
    stageNome: String(row.stage_nome),
    canonicalKey: isCrmStageKey(row.canonical_key) ? row.canonical_key : null,
    lastNote: String(row.notes ?? ""),
    outcome: mapOutcome(row.outcome),
    kind: String(row.kind),
    dueAt: asIso(row.due_at),
    status: row.status === "done" ? "done" : "open",
  }));
}

function loadSourcesMock(userId: string): BoxQueueSource[] {
  const store = getMockStore();
  const owned = new Set(
    store.crm_pipelines
      .filter((row) => row.user_id === userId)
      .map((row) => row.id),
  );
  const pipelines = new Map(
    store.crm_pipelines.map((row) => [row.id, row]),
  );
  const stages = new Map(store.crm_stages.map((row) => [row.id, row]));
  const deals = store.crm_deals.filter(
    (deal) => owned.has(deal.pipeline_id) && deal.outcome === "open",
  );
  const dealById = new Map(deals.map((deal) => [deal.id, deal]));

  return store.crm_activities
    .filter((activity) => activity.status === "open")
    .flatMap((activity) => {
      const deal = dealById.get(activity.deal_id);
      if (!deal) return [];
      const stage = stages.get(deal.stage_id);
      const pipeline = pipelines.get(deal.pipeline_id);
      return [
        {
          activityId: activity.id,
          dealId: deal.id,
          pipelineId: deal.pipeline_id,
          pipelineNome: pipeline?.nome ?? "CRM",
          companyName: deal.company_name,
          contactName: deal.contact_name,
          cnpj: deal.cnpj,
          searchId: searchIdFromMeta(deal.meta),
          phones: phonesFromDeal(deal),
          stageNome: stage?.nome ?? "Etapa",
          canonicalKey: stage?.canonical_key ?? null,
          lastNote: deal.notes,
          outcome: deal.outcome,
          kind: activity.kind,
          dueAt: activity.due_at,
          status: activity.status,
        } satisfies BoxQueueSource,
      ];
    });
}

async function loadRhythmPg(userId: string, now: Date): Promise<BoxRhythm> {
  const since = new Date(now.getTime() - 20 * 86_400_000).toISOString();
  const [profileRows, callRows, eventRows] = await Promise.all([
    optionalQuery<{ meta_ligacoes_dia: number | null }>(
      `select meta_ligacoes_dia from profiles where id = $1`,
      [userId],
    ),
    optionalQuery<{ created_at: string }>(
      `select created_at from call_events
        where user_id = $1 and created_at >= $2::timestamptz`,
      [userId, since],
    ),
    optionalQuery<{ kind: string; created_at: string }>(
      `select e.kind, e.created_at
         from crm_events e
         join crm_deals d on d.id = e.deal_id
         join crm_pipelines p on p.id = d.pipeline_id
        where p.user_id = $1
          and e.kind in ('ligar', 'whatsapp', 'reuniao')
          and e.created_at >= $2::timestamptz`,
      [userId, since],
    ),
  ]);
  return buildBoxRhythm({
    now,
    callGoal:
      Number(profileRows[0]?.meta_ligacoes_dia ?? DEFAULT_CALL_GOAL) ||
      DEFAULT_CALL_GOAL,
    callCreatedAt: callRows.map((row) => asIso(row.created_at)),
    crmEvents: eventRows.map((row) => ({
      kind: String(row.kind),
      created_at: asIso(row.created_at),
    })),
  });
}

function loadRhythmMock(userId: string, now: Date): BoxRhythm {
  const store = getMockStore();
  const profile = store.profiles.find((row) => row.id === userId);
  const owned = new Set(
    store.crm_pipelines
      .filter((row) => row.user_id === userId)
      .map((row) => row.id),
  );
  const dealIds = new Set(
    store.crm_deals
      .filter((deal) => owned.has(deal.pipeline_id))
      .map((deal) => deal.id),
  );
  return buildBoxRhythm({
    now,
    callGoal: profile?.meta_ligacoes_dia || DEFAULT_CALL_GOAL,
    callCreatedAt: store.call_events
      .filter((row) => row.user_id === userId)
      .map((row) => row.created_at),
    crmEvents: store.crm_events
      .filter(
        (row) =>
          dealIds.has(row.deal_id) &&
          (row.kind === "ligar" ||
            row.kind === "whatsapp" ||
            row.kind === "reuniao"),
      )
      .map((row) => ({ kind: row.kind, created_at: row.created_at })),
  });
}

function ownedOpenDeals(userId: string) {
  const store = getMockStore();
  const owned = new Set(
    store.crm_pipelines
      .filter((row) => row.user_id === userId)
      .map((row) => row.id),
  );
  return store.crm_deals.filter(
    (deal) => owned.has(deal.pipeline_id) && deal.outcome === "open",
  );
}

function loadIdleMock(userId: string): BoxQueueIdle {
  const deals = ownedOpenDeals(userId);
  const dealIds = new Set(deals.map((deal) => deal.id));
  const store = getMockStore();
  const otherOpen = store.crm_activities.filter(
    (activity) =>
      activity.status === "open" &&
      dealIds.has(activity.deal_id) &&
      !isBoxQueueKind(activity.kind),
  );
  return {
    openDealCount: deals.length,
    openOtherActivityCount: otherOpen.length,
  };
}

async function loadIdlePg(userId: string): Promise<BoxQueueIdle> {
  const { rows } = await query<{
    open_deals: number;
    other_open: number;
  }>(
    `select
        (select count(*)::int
           from crm_deals d
           join crm_pipelines p on p.id = d.pipeline_id
          where p.user_id = $1 and d.outcome = 'open') as open_deals,
        (select count(*)::int
           from crm_activities a
           join crm_deals d on d.id = a.deal_id
           join crm_pipelines p on p.id = d.pipeline_id
          where p.user_id = $1
            and a.status = 'open'
            and d.outcome = 'open'
            and a.kind not in ('ligar', 'whatsapp')) as other_open`,
    [userId],
  );
  return {
    openDealCount: Number(rows[0]?.open_deals ?? 0),
    openOtherActivityCount: Number(rows[0]?.other_open ?? 0),
  };
}

export async function loadBoxQueue(
  userId: string,
  now = new Date(),
  flags?: { crmAllowed: boolean; trialExpired: boolean },
): Promise<BoxQueuePayload> {
  let resolved = flags;
  if (!resolved) {
    const balance = await getBalance(userId);
    resolved = {
      crmAllowed: balance.enrichAllowed,
      trialExpired: balance.trialExpired,
    };
  }

  const live = getDataSource() === "supabase";
  if (live && !hasLiveDatabase()) {
    throw new BoxQueueError("Banco indisponível para o Box.");
  }

  let rhythm: BoxRhythm;
  let sources: BoxQueueSource[] = [];
  let idle: BoxQueueIdle = emptyIdle();
  try {
    const rhythmPromise = live
      ? loadRhythmPg(userId, now)
      : Promise.resolve(loadRhythmMock(userId, now));
    const sourcesPromise = resolved.crmAllowed
      ? live
        ? loadSourcesPg(userId)
        : Promise.resolve(loadSourcesMock(userId))
      : Promise.resolve([]);
    const idlePromise = resolved.crmAllowed
      ? live
        ? loadIdlePg(userId)
        : Promise.resolve(loadIdleMock(userId))
      : Promise.resolve(emptyIdle());
    [rhythm, sources, idle] = await Promise.all([
      rhythmPromise,
      sourcesPromise,
      idlePromise,
    ]);
  } catch (err) {
    throw new BoxQueueError(
      err instanceof Error ? err.message : "Não foi possível carregar a fila",
      500,
    );
  }

  if (!resolved.crmAllowed) {
    return toPayload(emptyQueue(), resolved, rhythm, emptyIdle());
  }

  return toPayload(buildBoxQueue(sources, now), resolved, rhythm, idle);
}
