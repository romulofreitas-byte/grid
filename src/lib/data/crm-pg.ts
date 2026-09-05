import { digitsCnpj } from "@/lib/crm/bridge";
import {
  briefingPresenceFromFields,
  type CrmBriefingLookup,
} from "@/lib/crm/briefing";
import {
  cloneDefaultCadenceEntries,
  isCrmStageKey,
  pickCreateStage,
} from "@/lib/crm/cadence";
import {
  DEAL_SEARCH_MIN_CHARS,
  DEAL_SEARCH_MIN_DIGITS,
  canSearchDeals,
  clampDealSearchLimit,
  dealSearchDigits,
  dealSearchHasLetters,
} from "@/lib/crm/deal-search";
import { uniquePhones } from "@/lib/crm/dial";
import { CRM_EVENT_HISTORY_LIMIT } from "@/lib/crm/events";
import {
  INBOUND_EVENT_KEEP,
  INBOUND_EVENT_LIST_LIMIT,
  mapInboundEventRow,
} from "@/lib/crm/inbound-events";
import {
  IMPORT_RUN_KEEP,
  IMPORT_RUN_LIST_LIMIT,
  parseImportRunIssues,
} from "@/lib/crm/import-history";
import { escapeIlike, sqlFoldAccent } from "@/lib/data/company-search";
import { normalizeText } from "@/lib/normalize-text";
import { formatPhone } from "@/lib/format";
import { planDeleteStage } from "@/lib/crm/stages";
import { peopleFromDeal, sanitizePeople, snapshotContactName } from "@/lib/crm/people";
import type {
  CrmActivity,
  CrmActivityKind,
  CrmBoard,
  CrmDeal,
  CrmDealCard,
  CrmDealCreateInput,
  CrmDealPatch,
  CrmDealSearchHit,
  CrmEvent,
  CrmEventCreateInput,
  CrmEventKind,
  CrmFormChannel,
  CrmInboundEndpoint,
  CrmInboundEvent,
  CrmInboundEventCreateInput,
  CrmImportRun,
  CrmImportRunCreateInput,
  CrmLeadKind,
  CrmNextAction,
  CrmOutcome,
  CrmPipeline,
  CrmPipelineSummary,
  CrmStage,
} from "@/lib/crm/types";
import { isUndefinedTableError, query, withTransaction, type SqlQuery } from "@/lib/data/pg";
import type { QueryResultRow } from "pg";

function asIso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function mapPipeline(row: QueryResultRow): CrmPipeline {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    nome: String(row.nome),
    position: Number(row.position),
    created_at: asIso(row.created_at),
  };
}

function mapStage(row: QueryResultRow): CrmStage {
  const key = row.canonical_key == null ? null : String(row.canonical_key);
  return {
    id: String(row.id),
    pipeline_id: String(row.pipeline_id),
    nome: String(row.nome),
    position: Number(row.position),
    canonical_key: isCrmStageKey(key) ? key : null,
    created_at: asIso(row.created_at),
  };
}

function mapDeal(row: QueryResultRow): CrmDeal {
  const metaRaw = row.meta;
  const meta =
    metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw)
      ? (metaRaw as CrmDeal["meta"])
      : {};
  return {
    id: String(row.id),
    pipeline_id: String(row.pipeline_id),
    stage_id: String(row.stage_id),
    company_name: String(row.company_name),
    contact_name: String(row.contact_name ?? ""),
    secretaries: asStringList(row.secretaries),
    people: peopleFromDeal({
      contact_name: String(row.contact_name ?? ""),
      secretaries: asStringList(row.secretaries),
      people: row.people,
    }),
    phones: asStringList(row.phones),
    notes: String(row.notes ?? ""),
    cnpj: row.cnpj == null || row.cnpj === "" ? null : String(row.cnpj),
    meta,
    outcome: mapOutcome(row.outcome),
    amount_cents:
      row.amount_cents == null || row.amount_cents === ""
        ? null
        : Number(row.amount_cents),
    position: Number(row.position),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  };
}

function mapActivity(row: QueryResultRow): CrmActivity {
  return {
    id: String(row.id),
    deal_id: String(row.deal_id),
    kind: row.kind as CrmActivityKind,
    due_at: asIso(row.due_at),
    status: row.status === "done" ? "done" : "open",
    created_at: asIso(row.created_at),
  };
}

function mapOutcome(value: unknown): CrmOutcome {
  return value === "won" || value === "lost" ? value : "open";
}

function mapEventMeta(value: unknown): CrmEvent["meta"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const meta: CrmEvent["meta"] = {};
  if (typeof raw.phone === "string" && raw.phone.trim()) {
    meta.phone = raw.phone;
  }
  if (raw.outcome === "open" || raw.outcome === "won" || raw.outcome === "lost") {
    meta.outcome = raw.outcome;
  }
  return meta;
}

function mapEvent(row: QueryResultRow): CrmEvent {
  return {
    id: String(row.id),
    deal_id: String(row.deal_id),
    kind: row.kind as CrmEventKind,
    body: String(row.body ?? ""),
    meta: mapEventMeta(row.meta),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  };
}

function mapInboundEndpoint(row: QueryResultRow): CrmInboundEndpoint {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    pipeline_id: String(row.pipeline_id),
    stage_id: row.stage_id == null || row.stage_id === "" ? null : String(row.stage_id),
    nome: String(row.nome ?? "Campanha"),
    lead_kind: row.lead_kind === "person" ? "person" : "company",
    channel: row.channel === "ads" ? "ads" : "site",
    token_hash: String(row.token_hash),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  };
}

function mapInboundEvent(row: QueryResultRow): CrmInboundEvent | null {
  return mapInboundEventRow({
    id: row.id,
    endpoint_id: row.endpoint_id,
    user_id: row.user_id,
    status: row.status,
    http_status: row.http_status,
    message: row.message,
    deal_id: row.deal_id,
    snapshot: row.snapshot,
    payload: row.payload,
    created_at: row.created_at,
  });
}

async function ownedPipeline(
  q: SqlQuery,
  userId: string,
  pipelineId: string,
): Promise<CrmPipeline | null> {
  const { rows } = await q(
    `select * from crm_pipelines where id = $1 and user_id = $2`,
    [pipelineId, userId],
  );
  return rows[0] ? mapPipeline(rows[0]) : null;
}

async function ownedDeal(
  q: SqlQuery,
  userId: string,
  dealId: string,
): Promise<CrmDeal | null> {
  const { rows } = await q(
    `select d.*
     from crm_deals d
     join crm_pipelines p on p.id = d.pipeline_id
     where d.id = $1 and p.user_id = $2`,
    [dealId, userId],
  );
  return rows[0] ? mapDeal(rows[0]) : null;
}

async function listStages(q: SqlQuery, pipelineId: string): Promise<CrmStage[]> {
  const { rows } = await q(
    `select * from crm_stages where pipeline_id = $1 order by position asc`,
    [pipelineId],
  );
  return rows.map(mapStage);
}

async function loadOpenActivity(
  q: SqlQuery,
  dealId: string,
): Promise<CrmActivity | null> {
  const activity = await q(
    `select * from crm_activities
     where deal_id = $1 and status = 'open'
     order by created_at desc
     limit 1`,
    [dealId],
  );
  return activity.rows[0] ? mapActivity(activity.rows[0]) : null;
}

async function loadCard(q: SqlQuery, dealId: string): Promise<CrmDealCard | null> {
  const { rows } = await q(`select * from crm_deals where id = $1`, [dealId]);
  if (!rows[0]) return null;
  const deal = mapDeal(rows[0]);
  return {
    ...deal,
    next_activity: await loadOpenActivity(q, dealId),
  };
}

async function compactStage(q: SqlQuery, stageId: string): Promise<void> {
  await q(
    `with ordered as (
       select id, row_number() over (order by position, created_at) - 1 as pos
       from crm_deals
       where stage_id = $1
     )
     update crm_deals d
        set position = ordered.pos
       from ordered
      where d.id = ordered.id`,
    [stageId],
  );
}

async function insertCadence(
  q: SqlQuery,
  pipelineId: string,
): Promise<void> {
  const cadence = cloneDefaultCadenceEntries();
  for (let position = 0; position < cadence.length; position += 1) {
    const entry = cadence[position]!;
    await q(
      `insert into crm_stages (pipeline_id, nome, position, canonical_key)
       values ($1, $2, $3, $4)`,
      [pipelineId, entry.nome, position, entry.key],
    );
  }
}

async function createPipelineRow(
  q: SqlQuery,
  userId: string,
  nome: string,
): Promise<CrmPipeline> {
  const count = await q(
    `select count(*)::int as n from crm_pipelines where user_id = $1`,
    [userId],
  );
  const position = Number(count.rows[0]?.n ?? 0);
  const inserted = await q(
    `insert into crm_pipelines (user_id, nome, position)
     values ($1, $2, $3)
     returning *`,
    [userId, nome, position],
  );
  const pipeline = mapPipeline(inserted.rows[0]!);
  await insertCadence(q, pipeline.id);
  return pipeline;
}

async function listPipelineRows(userId: string): Promise<CrmPipeline[]> {
  const { rows } = await query(
    `select * from crm_pipelines where user_id = $1 order by position, created_at`,
    [userId],
  );
  return rows.map(mapPipeline);
}

async function assembleBoard(pipeline: CrmPipeline): Promise<CrmBoard> {
  const [stages, deals, activities] = await Promise.all([
    listStages(query, pipeline.id),
    query(
      `select * from crm_deals where pipeline_id = $1 order by position, created_at`,
      [pipeline.id],
    ),
    query(
      `select a.*
       from crm_activities a
       join crm_deals d on d.id = a.deal_id
       where d.pipeline_id = $1 and a.status = 'open'`,
      [pipeline.id],
    ),
  ]);
  const openByDeal = new Map<string, CrmActivity>();
  for (const row of activities.rows) {
    const activity = mapActivity(row);
    openByDeal.set(activity.deal_id, activity);
  }
  return {
    pipeline,
    stages,
    deals: deals.rows.map((row) => {
      const deal = mapDeal(row);
      return { ...deal, next_activity: openByDeal.get(deal.id) ?? null };
    }),
  };
}

async function insertEvent(
  q: SqlQuery,
  dealId: string,
  kind: CrmEventKind,
  body: string,
  meta: CrmEvent["meta"] = {},
): Promise<CrmEvent> {
  const inserted = await q(
    `insert into crm_events (deal_id, kind, body, meta)
     values ($1, $2, $3, $4::jsonb)
     returning *`,
    [dealId, kind, body, JSON.stringify(meta)],
  );
  if (body.trim()) {
    await q(
      `update crm_deals set notes = $2, updated_at = now() where id = $1`,
      [dealId, body],
    );
  } else {
    await q(`update crm_deals set updated_at = now() where id = $1`, [dealId]);
  }
  return mapEvent(inserted.rows[0]!);
}

async function closeOpen(q: SqlQuery, dealId: string): Promise<void> {
  await q(
    `update crm_activities set status = 'done' where deal_id = $1 and status = 'open'`,
    [dealId],
  );
}

async function insertOpen(
  q: SqlQuery,
  dealId: string,
  kind: CrmActivityKind,
  dueAt: string,
): Promise<void> {
  await closeOpen(q, dealId);
  await q(
    `insert into crm_activities (deal_id, kind, due_at, status)
     values ($1, $2, $3::timestamptz, 'open')`,
    [dealId, kind, dueAt],
  );
}

function mapImportRun(row: QueryResultRow, includeIssues: boolean): CrmImportRun {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    pipeline_id:
      row.pipeline_id == null || row.pipeline_id === ""
        ? null
        : String(row.pipeline_id),
    pipeline_nome: String(row.pipeline_nome ?? ""),
    file_name:
      row.file_name == null || row.file_name === ""
        ? null
        : String(row.file_name),
    created: Number(row.created_count ?? 0),
    skipped: Number(row.skipped_count ?? 0),
    error_count: Number(row.error_count ?? 0),
    matched_cnpjs: Number(row.matched_cnpjs ?? 0),
    list_id: row.list_id == null || row.list_id === "" ? null : String(row.list_id),
    qualified: Number(row.qualified ?? 0),
    issues: includeIssues ? parseImportRunIssues(row.issues) : [],
    created_at: asIso(row.created_at),
  };
}

export const crmPgMethods = {
  async listCrmPipelines(userId: string): Promise<CrmPipelineSummary[]> {
    const { rows } = await query(
      `select p.*, coalesce(c.n, 0)::int as deal_count
         from crm_pipelines p
         left join (
           select d.pipeline_id, count(*)::int as n
             from crm_deals d
             join crm_pipelines owner on owner.id = d.pipeline_id
            where owner.user_id = $1
            group by d.pipeline_id
         ) c on c.pipeline_id = p.id
        where p.user_id = $1
        order by p.position, p.created_at`,
      [userId],
    );
    return rows.map((row) => ({
      ...mapPipeline(row),
      deal_count: Number(row.deal_count ?? 0),
    }));
  },

  async getCrmBoard(
    userId: string,
    pipelineId: string,
  ): Promise<CrmBoard | null> {
    const pipeline = await ownedPipeline(query, userId, pipelineId);
    if (!pipeline) return null;
    return assembleBoard(pipeline);
  },

  async createCrmPipeline(userId: string, nome: string): Promise<CrmPipeline> {
    return withTransaction((q) => createPipelineRow(q, userId, nome));
  },

  async updateCrmPipeline(
    userId: string,
    pipelineId: string,
    patch: { nome?: string; position?: number },
  ): Promise<CrmPipeline | null> {
    const { rows } = await query(
      `update crm_pipelines
          set nome = coalesce($3, nome),
              position = coalesce($4, position)
        where id = $1 and user_id = $2
        returning *`,
      [pipelineId, userId, patch.nome ?? null, patch.position ?? null],
    );
    return rows[0] ? mapPipeline(rows[0]) : null;
  },

  async reorderCrmPipelines(
    userId: string,
    pipelineIds: string[],
  ): Promise<boolean> {
    return withTransaction(async (q) => {
      const { rows } = await q(
        `select id from crm_pipelines where user_id = $1`,
        [userId],
      );
      if (rows.length !== pipelineIds.length) return false;
      if (new Set(pipelineIds).size !== pipelineIds.length) return false;
      const known = new Set(rows.map((row) => String(row.id)));
      if (pipelineIds.some((pipelineId) => !known.has(pipelineId))) return false;
      for (let position = 0; position < pipelineIds.length; position += 1) {
        await q(
          `update crm_pipelines set position = $2 where id = $1 and user_id = $3`,
          [pipelineIds[position], position, userId],
        );
      }
      return true;
    });
  },

  async deleteCrmPipeline(userId: string, pipelineId: string): Promise<boolean> {
    const owned = await listPipelineRows(userId);
    if (owned.length <= 1) return false;
    return withTransaction(async (q) => {
      const pipeline = await ownedPipeline(q, userId, pipelineId);
      if (!pipeline) return false;
      await q(
        `delete from crm_activities
          where deal_id in (select id from crm_deals where pipeline_id = $1)`,
        [pipelineId],
      );
      await q(`delete from crm_deals where pipeline_id = $1`, [pipelineId]);
      await q(`delete from crm_stages where pipeline_id = $1`, [pipelineId]);
      await q(`delete from crm_pipelines where id = $1 and user_id = $2`, [
        pipelineId,
        userId,
      ]);
      return true;
    });
  },

  async createCrmStage(
    userId: string,
    pipelineId: string,
    nome: string,
  ): Promise<CrmStage | null> {
    return withTransaction(async (q) => {
      if (!(await ownedPipeline(q, userId, pipelineId))) return null;
      const count = await q(
        `select count(*)::int as n from crm_stages where pipeline_id = $1`,
        [pipelineId],
      );
      const inserted = await q(
        `insert into crm_stages (pipeline_id, nome, position, canonical_key)
         values ($1, $2, $3, null)
         returning *`,
        [pipelineId, nome, Number(count.rows[0]?.n ?? 0)],
      );
      return mapStage(inserted.rows[0]!);
    });
  },

  async updateCrmStage(
    userId: string,
    stageId: string,
    patch: { nome?: string; position?: number },
  ): Promise<CrmStage | null> {
    const { rows } = await query(
      `update crm_stages s
          set nome = coalesce($3, s.nome),
              position = coalesce($4, s.position)
         from crm_pipelines p
        where s.id = $1
          and p.id = s.pipeline_id
          and p.user_id = $2
        returning s.*`,
      [stageId, userId, patch.nome ?? null, patch.position ?? null],
    );
    return rows[0] ? mapStage(rows[0]) : null;
  },

  async deleteCrmStage(
    userId: string,
    stageId: string,
    moveToStageId?: string | null,
  ): Promise<boolean> {
    return withTransaction(async (q) => {
      const found = await q(
        `select s.*
           from crm_stages s
           join crm_pipelines p on p.id = s.pipeline_id
          where s.id = $1 and p.user_id = $2`,
        [stageId, userId],
      );
      if (!found.rows[0]) return false;
      const stage = mapStage(found.rows[0]);
      const stages = await listStages(q, stage.pipeline_id);
      const count = await q(
        `select count(*)::int as n from crm_deals where stage_id = $1`,
        [stageId],
      );
      const plan = planDeleteStage({
        stages,
        stageId,
        dealCount: Number(count.rows[0]?.n ?? 0),
        moveToStageId,
      });
      if (!plan.ok) return false;
      if (plan.moveToStageId) {
        const max = await q(
          `select coalesce(max(position), -1)::int as n
             from crm_deals where stage_id = $1`,
          [plan.moveToStageId],
        );
        let nextPos = Number(max.rows[0]?.n ?? -1) + 1;
        const moving = await q(
          `select id from crm_deals where stage_id = $1 order by position`,
          [stageId],
        );
        for (const row of moving.rows) {
          await q(
            `update crm_deals
                set stage_id = $2, position = $3, updated_at = now()
              where id = $1`,
            [row.id, plan.moveToStageId, nextPos],
          );
          nextPos += 1;
        }
      }
      await q(`delete from crm_stages where id = $1`, [stageId]);
      await q(
        `with ordered as (
           select id, row_number() over (order by position, created_at) - 1 as pos
           from crm_stages
           where pipeline_id = $1
         )
         update crm_stages s
            set position = ordered.pos
           from ordered
          where s.id = ordered.id`,
        [stage.pipeline_id],
      );
      return true;
    });
  },

  async reorderCrmStages(
    userId: string,
    pipelineId: string,
    stageIds: string[],
  ): Promise<boolean> {
    return withTransaction(async (q) => {
      if (!(await ownedPipeline(q, userId, pipelineId))) return false;
      const stages = await listStages(q, pipelineId);
      if (stages.length !== stageIds.length) return false;
      const known = new Set(stages.map((row) => row.id));
      if (stageIds.some((stageId) => !known.has(stageId))) return false;
      for (let position = 0; position < stageIds.length; position += 1) {
        await q(`update crm_stages set position = $2 where id = $1`, [
          stageIds[position],
          position,
        ]);
      }
      return true;
    });
  },

  async createCrmDeal(
    userId: string,
    input: CrmDealCreateInput,
  ): Promise<CrmDealCard | null> {
    return withTransaction(async (q) => {
      if (!(await ownedPipeline(q, userId, input.pipelineId))) return null;
      const cnpj =
        input.cnpj == null || input.cnpj === ""
          ? null
          : String(input.cnpj).replace(/\D/g, "").padStart(14, "0");
      if (cnpj) {
        const existing = await q(
          `select d.id
             from crm_deals d
             join crm_pipelines p on p.id = d.pipeline_id
            where d.pipeline_id = $1 and d.cnpj = $2 and p.user_id = $3
            limit 1`,
          [input.pipelineId, cnpj, userId],
        );
        if (existing.rows[0]) {
          return loadCard(q, String(existing.rows[0].id));
        }
      }
      const stages = await listStages(q, input.pipelineId);
      const stageId = pickCreateStage(stages, input.stage_id)?.id;
      if (!stageId) return null;
      const count = await q(
        `select count(*)::int as n from crm_deals where stage_id = $1`,
        [stageId],
      );
      const secretaries = asStringList(input.secretaries);
      const people = peopleFromDeal({
        contact_name: input.contact_name?.trim() ?? "",
        secretaries,
        people: input.people,
      });
      const contactName =
        input.contact_name?.trim() || snapshotContactName(people);
      const phones = uniquePhones([
        ...asStringList(input.phones),
        ...people.map((person) => person.phone),
      ]).slice(0, 8);
      const inserted = await q(
        `insert into crm_deals (
           pipeline_id, stage_id, company_name, contact_name, secretaries, people, phones, notes, cnpj, meta, position
         ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10::jsonb, $11)
         returning *`,
        [
          input.pipelineId,
          stageId,
          input.company_name.trim(),
          contactName,
          JSON.stringify(secretaries),
          JSON.stringify(people),
          JSON.stringify(phones),
          input.notes?.trim() ?? "",
          cnpj,
          JSON.stringify(input.meta ?? {}),
          Number(count.rows[0]?.n ?? 0),
        ],
      );
      const dealId = String(inserted.rows[0]!.id);
      const notes = input.notes?.trim() ?? "";
      if (notes) {
        await insertEvent(q, dealId, "nota", notes);
      }
      return loadCard(q, dealId);
    });
  },

  async findCrmDealByCnpj(
    userId: string,
    pipelineId: string,
    cnpj: string,
  ): Promise<CrmDealCard | null> {
    const digits = cnpj.replace(/\D/g, "").padStart(14, "0");
    const { rows } = await query(
      `select d.id
         from crm_deals d
         join crm_pipelines p on p.id = d.pipeline_id
        where d.pipeline_id = $1 and d.cnpj = $2 and p.user_id = $3
        limit 1`,
      [pipelineId, digits, userId],
    );
    if (!rows[0]) return null;
    return loadCard(query, String(rows[0].id));
  },

  async findCrmDealByCnpjForUser(
    userId: string,
    cnpj: string,
    preferredPipelineId?: string | null,
  ): Promise<CrmDealCard | null> {
    const digits = cnpj.replace(/\D/g, "").padStart(14, "0");
    const { rows } = await query(
      `select d.id
         from crm_deals d
         join crm_pipelines p on p.id = d.pipeline_id
        where p.user_id = $1 and d.cnpj = $2
        order by
          case when d.pipeline_id = $3 then 0 else 1 end,
          d.updated_at desc
        limit 1`,
      [userId, digits, preferredPipelineId ?? null],
    );
    if (!rows[0]) return null;
    return loadCard(query, String(rows[0].id));
  },

  async hasCrmPipeline(userId: string): Promise<boolean> {
    const { rows } = await query(
      `select 1 from crm_pipelines where user_id = $1 limit 1`,
      [userId],
    );
    return Boolean(rows[0]);
  },

  async listCrmDealCnpjs(
    userId: string,
    cnpjs: string[],
  ): Promise<string[]> {
    const digits = [
      ...new Set(
        cnpjs
          .map((value) => value.replace(/\D/g, "").padStart(14, "0"))
          .filter((value) => value.length === 14),
      ),
    ];
    if (digits.length === 0) return [];
    const { rows } = await query(
      `select distinct d.cnpj
         from crm_deals d
         join crm_pipelines p on p.id = d.pipeline_id
        where p.user_id = $1 and d.cnpj = any($2::text[])`,
      [userId, digits],
    );
    return rows.map((row) => String(row.cnpj));
  },

  async searchCrmDeals(
    userId: string,
    q: string,
    opts?: { preferredPipelineId?: string | null; limit?: number },
  ): Promise<CrmDealSearchHit[]> {
    if (!canSearchDeals(q)) return [];
    const limit = clampDealSearchLimit(opts?.limit);
    const trimmed = q.trim();
    const folded = normalizeText(q);
    const nameOk =
      dealSearchHasLetters(q) && folded.length >= DEAL_SEARCH_MIN_CHARS;
    const rawLike = nameOk ? `%${escapeIlike(trimmed)}%` : "";
    const foldedLike = nameOk ? `%${escapeIlike(folded)}%` : "";
    const prefix = nameOk ? `${escapeIlike(folded)}%` : null;
    const digits = dealSearchDigits(q);
    const digitNeedle =
      digits.length >= DEAL_SEARCH_MIN_DIGITS ? digits : "";
    const companyFold = sqlFoldAccent("d.company_name");
    const contactFold = sqlFoldAccent("coalesce(d.contact_name, '')");
    const peopleFold = sqlFoldAccent("coalesce(d.people::text, '')");
    const { rows } = await query(
      `select d.id,
              d.pipeline_id,
              p.nome as pipeline_nome,
              s.nome as stage_nome,
              d.company_name,
              d.contact_name,
              d.outcome
         from crm_pipelines p
         join crm_deals d on d.pipeline_id = p.id
         join crm_stages s on s.id = d.stage_id
        where p.user_id = $1
          and (
            (
              $2::text <> ''
              and (
                d.company_name ilike $2 escape '\\'
                or coalesce(d.contact_name, '') ilike $2 escape '\\'
                or coalesce(d.people::text, '') ilike $2 escape '\\'
                or ${companyFold} like $7 escape '\\'
                or ${contactFold} like $7 escape '\\'
                or ${peopleFold} like $7 escape '\\'
              )
            )
            or (
              $3::text <> ''
              and (
                coalesce(d.cnpj, '') like '%' || $3 || '%'
                or regexp_replace(
                     coalesce(d.phones::text, '') || coalesce(d.people::text, ''),
                     '\\D',
                     '',
                     'g'
                   ) like '%' || $3 || '%'
              )
            )
          )
        order by
          case when d.pipeline_id = $4::uuid then 0 else 1 end,
          case
            when $5::text is not null and ${companyFold} like $5 escape '\\'
            then 0 else 1
          end,
          d.updated_at desc
        limit $6::int`,
      [
        userId,
        rawLike,
        digitNeedle,
        opts?.preferredPipelineId ?? null,
        prefix,
        limit,
        foldedLike,
      ],
    );
    return rows.map((row) => ({
      dealId: String(row.id),
      pipelineId: String(row.pipeline_id),
      pipelineNome: String(row.pipeline_nome),
      stageNome: String(row.stage_nome),
      company_name: String(row.company_name),
      contact_name: String(row.contact_name ?? ""),
      outcome: mapOutcome(row.outcome),
    }));
  },

  async getCrmDeal(
    userId: string,
    dealId: string,
  ): Promise<CrmDealCard | null> {
    const deal = await ownedDeal(query, userId, dealId);
    if (!deal) return null;
    return {
      ...deal,
      next_activity: await loadOpenActivity(query, dealId),
    };
  },

  async getCrmBriefingLookup(cnpj: string): Promise<CrmBriefingLookup | null> {
    const padded = digitsCnpj(cnpj);
    if (padded.replace(/0/g, "").length === 0) return null;
    const { rows } = await query(
      `select e.ddd1,
              e.telefone1,
              e.ddd2,
              e.telefone2,
              m.nome as municipio_nome,
              le.domain_status,
              le.socials,
              le.whatsapp,
              le.gmb,
              le.expires_at
         from establishments e
         left join ref_municipio m on m.id = e.municipio_id
         left join lead_enrichment le on le.cnpj = e.cnpj
        where e.cnpj = $1::char(14)
        limit 1`,
      [padded],
    );
    const row = rows[0];
    if (!row) return null;
    const extraPhones = uniquePhones(
      [
        formatPhone(
          row.ddd1 == null ? null : String(row.ddd1),
          row.telefone1 == null ? null : String(row.telefone1),
        ),
        formatPhone(
          row.ddd2 == null ? null : String(row.ddd2),
          row.telefone2 == null ? null : String(row.telefone2),
        ),
      ].filter((value): value is string => Boolean(value)),
    );
    const expiresAt = row.expires_at
      ? new Date(String(row.expires_at)).getTime()
      : 0;
    const enrichmentVisible = expiresAt > Date.now();
    const socials =
      row.socials && typeof row.socials === "object" && !Array.isArray(row.socials)
        ? (row.socials as Record<string, unknown>)
        : {};
    const gmb =
      row.gmb && typeof row.gmb === "object" && !Array.isArray(row.gmb)
        ? (row.gmb as { matched?: unknown })
        : null;
    return {
      municipioNome: row.municipio_nome ? String(row.municipio_nome) : null,
      extraPhones,
      presence: enrichmentVisible
        ? briefingPresenceFromFields({
            domainStatus:
              row.domain_status == null ? null : String(row.domain_status),
            instagram: socials.instagram,
            whatsapp: row.whatsapp,
            gmbMatched: gmb?.matched,
          })
        : null,
    };
  },

  async updateCrmDeal(
    userId: string,
    dealId: string,
    patch: CrmDealPatch,
  ): Promise<CrmDealCard | null> {
    return withTransaction(async (q) => {
      const deal = await ownedDeal(q, userId, dealId);
      if (!deal) return null;
      const people = patch.people ? sanitizePeople(patch.people) : null;
      const contactName = people
        ? snapshotContactName(people)
        : (patch.contact_name ?? null);
      const secretaries = patch.secretaries
        ? asStringList(patch.secretaries)
        : null;
      await q(
        `update crm_deals
            set company_name = coalesce($2, company_name),
                contact_name = coalesce($3, contact_name),
                secretaries = coalesce($4::jsonb, secretaries),
                people = coalesce($5::jsonb, people),
                phones = coalesce($6::jsonb, phones),
                notes = coalesce($7, notes),
                amount_cents = case when $8::boolean then $9 else amount_cents end,
                cnpj = case when $10::boolean then $11 else cnpj end,
                meta = case when $12::boolean then $13::jsonb else meta end,
                updated_at = now()
          where id = $1`,
        [
          dealId,
          patch.company_name ?? null,
          contactName,
          secretaries ? JSON.stringify(secretaries) : null,
          people ? JSON.stringify(people) : null,
          patch.phones ? JSON.stringify(asStringList(patch.phones)) : null,
          patch.notes ?? null,
          patch.amount_cents !== undefined,
          patch.amount_cents ?? null,
          patch.cnpj !== undefined,
          patch.cnpj ?? null,
          patch.meta !== undefined,
          patch.meta ? JSON.stringify(patch.meta) : null,
        ],
      );
      return loadCard(q, dealId);
    });
  },

  async moveCrmDeal(
    userId: string,
    dealId: string,
    stageId: string,
    position: number,
  ): Promise<CrmDealCard | null> {
    return withTransaction(async (q) => {
      const deal = await ownedDeal(q, userId, dealId);
      if (!deal) return null;
      const stage = await q(
        `select id, pipeline_id from crm_stages where id = $1`,
        [stageId],
      );
      if (!stage.rows[0] || String(stage.rows[0].pipeline_id) !== deal.pipeline_id) {
        return null;
      }
      const fromStage = deal.stage_id;
      await q(
        `update crm_deals
            set position = position + 1
          where stage_id = $1 and id <> $2 and position >= $3`,
        [stageId, dealId, position],
      );
      await q(
        `update crm_deals
            set stage_id = $2, position = $3, updated_at = now()
          where id = $1`,
        [dealId, stageId, position],
      );
      await compactStage(q, stageId);
      if (fromStage !== stageId) await compactStage(q, fromStage);
      return loadCard(q, dealId);
    });
  },

  async deleteCrmDeal(userId: string, dealId: string): Promise<boolean> {
    return withTransaction(async (q) => {
      const deal = await ownedDeal(q, userId, dealId);
      if (!deal) return false;
      await q(`delete from crm_activities where deal_id = $1`, [dealId]);
      await q(`delete from crm_deals where id = $1`, [dealId]);
      await compactStage(q, deal.stage_id);
      return true;
    });
  },

  async scheduleCrmActivity(
    userId: string,
    dealId: string,
    kind: CrmActivityKind,
    dueAt: string,
  ): Promise<CrmDealCard | null> {
    return withTransaction(async (q) => {
      if (!(await ownedDeal(q, userId, dealId))) return null;
      await insertOpen(q, dealId, kind, dueAt);
      await q(`update crm_deals set updated_at = now() where id = $1`, [dealId]);
      return loadCard(q, dealId);
    });
  },

  async completeCrmActivity(
    userId: string,
    dealId: string,
  ): Promise<{ deal: CrmDealCard; event: CrmEvent | null } | null> {
    return withTransaction(async (q) => {
      if (!(await ownedDeal(q, userId, dealId))) return null;
      const open = await q(
        `select * from crm_activities
          where deal_id = $1 and status = 'open'
          order by created_at desc
          limit 1`,
        [dealId],
      );
      const current = open.rows[0] ? mapActivity(open.rows[0]) : null;
      if (!current) {
        const deal = await loadCard(q, dealId);
        return deal ? { deal, event: null } : null;
      }
      await closeOpen(q, dealId);
      const event = await insertEvent(q, dealId, current.kind, "");
      const deal = await loadCard(q, dealId);
      if (!deal) return null;
      return { deal, event };
    });
  },

  async logCrmCall(
    userId: string,
    dealId: string,
    notes: string,
    next?: CrmNextAction | null,
    phone?: string,
  ): Promise<{ deal: CrmDealCard; event: CrmEvent } | null> {
    return crmPgMethods.createCrmEvent(userId, dealId, {
      kind: "ligar",
      body: notes,
      next,
      meta: phone ? { phone } : {},
    });
  },

  async listCrmEvents(
    userId: string,
    dealId: string,
  ): Promise<CrmEvent[] | null> {
    if (!(await ownedDeal(query, userId, dealId))) return null;
    const { rows } = await query(
      `select * from crm_events where deal_id = $1 order by created_at desc limit $2`,
      [dealId, CRM_EVENT_HISTORY_LIMIT],
    );
    return rows.map(mapEvent);
  },

  async createCrmEvent(
    userId: string,
    dealId: string,
    input: CrmEventCreateInput,
  ): Promise<{ deal: CrmDealCard; event: CrmEvent } | null> {
    return withTransaction(async (q) => {
      if (!(await ownedDeal(q, userId, dealId))) return null;
      const event = await insertEvent(
        q,
        dealId,
        input.kind,
        input.body?.trim() ?? "",
        input.meta ?? {},
      );
      if (input.next) {
        await insertOpen(q, dealId, input.next.kind, input.next.dueAt);
      }
      const deal = await loadCard(q, dealId);
      if (!deal) return null;
      return { deal, event };
    });
  },

  async updateCrmEvent(
    userId: string,
    dealId: string,
    eventId: string,
    body: string,
  ): Promise<{ deal: CrmDealCard; event: CrmEvent } | null> {
    return withTransaction(async (q) => {
      if (!(await ownedDeal(q, userId, dealId))) return null;
      const updated = await q(
        `update crm_events
            set body = $3, updated_at = now()
          where id = $1 and deal_id = $2
          returning *`,
        [eventId, dealId, body],
      );
      if (!updated.rows[0]) return null;
      if (body.trim()) {
        await q(
          `update crm_deals set notes = $2, updated_at = now() where id = $1`,
          [dealId, body],
        );
      }
      const deal = await loadCard(q, dealId);
      if (!deal) return null;
      return { deal, event: mapEvent(updated.rows[0]) };
    });
  },

  async setCrmDealOutcome(
    userId: string,
    dealId: string,
    outcome: CrmOutcome,
  ): Promise<{ deal: CrmDealCard; event: CrmEvent } | null> {
    return withTransaction(async (q) => {
      const current = await ownedDeal(q, userId, dealId);
      if (!current) return null;
      if (current.outcome === outcome) {
        const deal = await loadCard(q, dealId);
        if (!deal) return null;
        const existing = await q(
          `select * from crm_events
            where deal_id = $1 and kind = 'outcome'
            order by created_at desc
            limit 1`,
          [dealId],
        );
        const event = existing.rows[0]
          ? mapEvent(existing.rows[0])
          : await insertEvent(q, dealId, "outcome", "", { outcome });
        return { deal, event };
      }
      await q(
        `update crm_deals set outcome = $2, updated_at = now() where id = $1`,
        [dealId, outcome],
      );
      const event = await insertEvent(q, dealId, "outcome", "", { outcome });
      const deal = await loadCard(q, dealId);
      if (!deal) return null;
      return { deal, event };
    });
  },

  async listCrmInboundEndpoints(
    userId: string,
  ): Promise<CrmInboundEndpoint[]> {
    try {
      const { rows } = await query(
        `select * from crm_inbound_endpoints
          where user_id = $1
          order by created_at desc`,
        [userId],
      );
      return rows.map(mapInboundEndpoint);
    } catch (err) {
      if (isUndefinedTableError(err)) return [];
      throw err;
    }
  },

  async getCrmInboundEndpointById(
    userId: string,
    endpointId: string,
  ): Promise<CrmInboundEndpoint | null> {
    try {
      const { rows } = await query(
        `select * from crm_inbound_endpoints
          where id = $1 and user_id = $2
          limit 1`,
        [endpointId, userId],
      );
      return rows[0] ? mapInboundEndpoint(rows[0]) : null;
    } catch (err) {
      if (isUndefinedTableError(err)) return null;
      throw err;
    }
  },

  async getCrmInboundEndpointByTokenHash(
    tokenHash: string,
  ): Promise<CrmInboundEndpoint | null> {
    try {
      const { rows } = await query(
        `select * from crm_inbound_endpoints where token_hash = $1 limit 1`,
        [tokenHash],
      );
      return rows[0] ? mapInboundEndpoint(rows[0]) : null;
    } catch (err) {
      if (isUndefinedTableError(err)) return null;
      throw err;
    }
  },

  async findCrmInboundEndpoint(
    endpointId: string,
  ): Promise<CrmInboundEndpoint | null> {
    try {
      const { rows } = await query(
        `select * from crm_inbound_endpoints where id = $1 limit 1`,
        [endpointId],
      );
      return rows[0] ? mapInboundEndpoint(rows[0]) : null;
    } catch (err) {
      if (isUndefinedTableError(err)) return null;
      throw err;
    }
  },

  async createCrmInboundEndpoint(
    userId: string,
    input: {
      nome: string;
      pipelineId: string;
      stage_id?: string | null;
      lead_kind: CrmLeadKind;
      channel: CrmFormChannel;
      token_hash: string;
    },
  ): Promise<CrmInboundEndpoint | null> {
    try {
      return await withTransaction(async (q) => {
        if (!(await ownedPipeline(q, userId, input.pipelineId))) return null;
        if (input.stage_id) {
          const stages = await listStages(q, input.pipelineId);
          if (!stages.some((stage) => stage.id === input.stage_id)) return null;
        }
        const { rows } = await q(
          `insert into crm_inbound_endpoints (
             user_id, pipeline_id, stage_id, nome, lead_kind, channel, token_hash
           ) values ($1, $2, $3, $4, $5, $6, $7)
           returning *`,
          [
            userId,
            input.pipelineId,
            input.stage_id ?? null,
            input.nome.trim(),
            input.lead_kind,
            input.channel,
            input.token_hash,
          ],
        );
        return rows[0] ? mapInboundEndpoint(rows[0]) : null;
      });
    } catch (err) {
      if (isUndefinedTableError(err)) return null;
      throw err;
    }
  },

  async updateCrmInboundEndpoint(
    userId: string,
    endpointId: string,
    input: {
      nome?: string;
      pipelineId?: string;
      stage_id?: string | null;
      lead_kind?: CrmLeadKind;
      channel?: CrmFormChannel;
      token_hash?: string;
    },
  ): Promise<CrmInboundEndpoint | null> {
    try {
      return await withTransaction(async (q) => {
        const current = await q(
          `select * from crm_inbound_endpoints where id = $1 and user_id = $2`,
          [endpointId, userId],
        );
        if (!current.rows[0]) return null;
        const pipelineId =
          input.pipelineId ?? String(current.rows[0].pipeline_id);
        if (!(await ownedPipeline(q, userId, pipelineId))) return null;
        const stageId =
          input.stage_id !== undefined
            ? input.stage_id
            : current.rows[0].stage_id == null
              ? null
              : String(current.rows[0].stage_id);
        if (stageId) {
          const stages = await listStages(q, pipelineId);
          if (!stages.some((stage) => stage.id === stageId)) return null;
        }
        const { rows } = await q(
          `update crm_inbound_endpoints
              set pipeline_id = $3,
                  stage_id = $4,
                  nome = coalesce($5, nome),
                  lead_kind = coalesce($6, lead_kind),
                  channel = coalesce($7, channel),
                  token_hash = coalesce($8, token_hash),
                  updated_at = now()
            where id = $1 and user_id = $2
            returning *`,
          [
            endpointId,
            userId,
            pipelineId,
            stageId,
            input.nome?.trim() ?? null,
            input.lead_kind ?? null,
            input.channel ?? null,
            input.token_hash ?? null,
          ],
        );
        return rows[0] ? mapInboundEndpoint(rows[0]) : null;
      });
    } catch (err) {
      if (isUndefinedTableError(err)) return null;
      throw err;
    }
  },

  async deleteCrmInboundEndpoint(
    userId: string,
    endpointId: string,
  ): Promise<boolean> {
    try {
      const { rowCount } = await query(
        `delete from crm_inbound_endpoints where id = $1 and user_id = $2`,
        [endpointId, userId],
      );
      return (rowCount ?? 0) > 0;
    } catch (err) {
      if (isUndefinedTableError(err)) return false;
      throw err;
    }
  },

  async createCrmInboundEvent(
    userId: string,
    input: CrmInboundEventCreateInput,
  ): Promise<CrmInboundEvent | null> {
    try {
      const { rows } = await query(
        `insert into crm_inbound_events (
           endpoint_id, user_id, status, http_status, message, deal_id, snapshot, payload
         )
         select $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb
           from crm_inbound_endpoints
          where id = $1 and user_id = $2
         returning *`,
        [
          input.endpointId,
          userId,
          input.status,
          input.httpStatus,
          input.message.slice(0, 200),
          input.dealId ?? null,
          JSON.stringify(input.snapshot),
          input.payload ? JSON.stringify(input.payload) : null,
        ],
      );
      await query(
        `delete from crm_inbound_events
         where endpoint_id = $1
           and id not in (
             select id from crm_inbound_events
             where endpoint_id = $1
             order by created_at desc
             limit $2
           )`,
        [input.endpointId, INBOUND_EVENT_KEEP],
      );
      return rows[0] ? mapInboundEvent(rows[0]) : null;
    } catch (err) {
      if (isUndefinedTableError(err)) return null;
      throw err;
    }
  },

  async listCrmInboundEvents(
    userId: string,
    endpointId: string,
    limit = INBOUND_EVENT_LIST_LIMIT,
  ): Promise<CrmInboundEvent[]> {
    const cap = Math.min(Math.max(limit, 1), INBOUND_EVENT_LIST_LIMIT);
    try {
      const { rows } = await query(
        `select * from crm_inbound_events
          where user_id = $1 and endpoint_id = $2
          order by created_at desc
          limit $3`,
        [userId, endpointId, cap],
      );
      return rows
        .map(mapInboundEvent)
        .filter((row): row is CrmInboundEvent => Boolean(row));
    } catch (err) {
      if (isUndefinedTableError(err)) return [];
      throw err;
    }
  },

  async listCrmInboundLastEvents(userId: string): Promise<CrmInboundEvent[]> {
    try {
      const { rows } = await query(
        `select distinct on (endpoint_id) *
           from crm_inbound_events
          where user_id = $1
          order by endpoint_id, created_at desc`,
        [userId],
      );
      return rows
        .map(mapInboundEvent)
        .filter((row): row is CrmInboundEvent => Boolean(row));
    } catch (err) {
      if (isUndefinedTableError(err)) return [];
      throw err;
    }
  },

  async createCrmImportRun(
    userId: string,
    input: CrmImportRunCreateInput,
  ): Promise<CrmImportRun | null> {
    try {
      const { rows } = await query(
        `insert into crm_import_runs (
           user_id, pipeline_id, pipeline_nome, file_name,
           created_count, skipped_count, error_count, matched_cnpjs,
           list_id, qualified, issues
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
         returning *`,
        [
          userId,
          input.pipelineId,
          input.pipelineNome.slice(0, 80),
          input.fileName?.trim().slice(0, 200) || null,
          input.created,
          input.skipped,
          input.errorCount,
          input.matchedCnpjs,
          input.listId ?? null,
          input.qualified,
          JSON.stringify(input.issues.slice(0, 500)),
        ],
      );
      await query(
        `delete from crm_import_runs
         where user_id = $1
           and id not in (
             select id from crm_import_runs
             where user_id = $1
             order by created_at desc
             limit $2
           )`,
        [userId, IMPORT_RUN_KEEP],
      );
      return rows[0] ? mapImportRun(rows[0], true) : null;
    } catch (err) {
      if (isUndefinedTableError(err)) return null;
      throw err;
    }
  },

  async listCrmImportRuns(
    userId: string,
    limit = IMPORT_RUN_LIST_LIMIT,
  ): Promise<CrmImportRun[]> {
    const cap = Math.min(Math.max(limit, 1), IMPORT_RUN_LIST_LIMIT);
    try {
      const { rows } = await query(
        `select id, user_id, pipeline_id, pipeline_nome, file_name,
                created_count, skipped_count, error_count, matched_cnpjs,
                list_id, qualified, created_at
         from crm_import_runs
         where user_id = $1
         order by created_at desc
         limit $2`,
        [userId, cap],
      );
      return rows.map((row) => mapImportRun(row, false));
    } catch (err) {
      if (isUndefinedTableError(err)) return [];
      throw err;
    }
  },

  async getCrmImportRun(
    userId: string,
    runId: string,
  ): Promise<CrmImportRun | null> {
    try {
      const { rows } = await query(
        `select * from crm_import_runs where id = $1 and user_id = $2`,
        [runId, userId],
      );
      return rows[0] ? mapImportRun(rows[0], true) : null;
    } catch (err) {
      if (isUndefinedTableError(err)) return null;
      throw err;
    }
  },
};
