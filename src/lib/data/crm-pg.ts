import { cloneDefaultCadence, DEFAULT_PIPELINE_NAME } from "@/lib/crm/cadence";
import { planDeleteStage } from "@/lib/crm/stages";
import type {
  CrmActivity,
  CrmActivityKind,
  CrmBoard,
  CrmDeal,
  CrmDealCard,
  CrmDealCreateInput,
  CrmDealPatch,
  CrmNextAction,
  CrmPipeline,
  CrmPipelineSummary,
  CrmStage,
} from "@/lib/crm/types";
import { query, withTransaction, type SqlQuery } from "@/lib/data/pg";
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
  return {
    id: String(row.id),
    pipeline_id: String(row.pipeline_id),
    nome: String(row.nome),
    position: Number(row.position),
    created_at: asIso(row.created_at),
  };
}

function mapDeal(row: QueryResultRow): CrmDeal {
  return {
    id: String(row.id),
    pipeline_id: String(row.pipeline_id),
    stage_id: String(row.stage_id),
    company_name: String(row.company_name),
    contact_name: String(row.contact_name ?? ""),
    secretaries: asStringList(row.secretaries),
    phones: asStringList(row.phones),
    notes: String(row.notes ?? ""),
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

async function loadCard(q: SqlQuery, dealId: string): Promise<CrmDealCard | null> {
  const { rows } = await q(`select * from crm_deals where id = $1`, [dealId]);
  if (!rows[0]) return null;
  const deal = mapDeal(rows[0]);
  const activity = await q(
    `select * from crm_activities
     where deal_id = $1 and status = 'open'
     order by created_at desc
     limit 1`,
    [dealId],
  );
  return {
    ...deal,
    next_activity: activity.rows[0] ? mapActivity(activity.rows[0]) : null,
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
  const cadence = cloneDefaultCadence();
  for (let position = 0; position < cadence.length; position += 1) {
    await q(
      `insert into crm_stages (pipeline_id, nome, position) values ($1, $2, $3)`,
      [pipelineId, cadence[position], position],
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
  const stages = await listStages(query, pipeline.id);
  const deals = await query(
    `select * from crm_deals where pipeline_id = $1 order by position, created_at`,
    [pipeline.id],
  );
  const activities = await query(
    `select a.*
     from crm_activities a
     join crm_deals d on d.id = a.deal_id
     where d.pipeline_id = $1 and a.status = 'open'`,
    [pipeline.id],
  );
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

export const crmPgMethods = {
  async listCrmPipelines(userId: string): Promise<CrmPipelineSummary[]> {
    let pipelines = await listPipelineRows(userId);
    if (pipelines.length === 0) {
      await withTransaction((q) =>
        createPipelineRow(q, userId, DEFAULT_PIPELINE_NAME),
      );
      pipelines = await listPipelineRows(userId);
    }
    const counts = await query(
      `select pipeline_id, count(*)::int as n
       from crm_deals
       where pipeline_id = any($1::uuid[])
       group by pipeline_id`,
      [pipelines.map((row) => row.id)],
    );
    const byId = new Map(
      counts.rows.map((row) => [String(row.pipeline_id), Number(row.n)]),
    );
    return pipelines.map((row) => ({
      ...row,
      deal_count: byId.get(row.id) ?? 0,
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
        `insert into crm_stages (pipeline_id, nome, position)
         values ($1, $2, $3)
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
      const first = await q(
        `select id from crm_stages
          where pipeline_id = $1
          order by position
          limit 1`,
        [input.pipelineId],
      );
      const stageId = first.rows[0]?.id as string | undefined;
      if (!stageId) return null;
      const count = await q(
        `select count(*)::int as n from crm_deals where stage_id = $1`,
        [stageId],
      );
      const inserted = await q(
        `insert into crm_deals (
           pipeline_id, stage_id, company_name, contact_name, secretaries, phones, notes, position
         ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
         returning *`,
        [
          input.pipelineId,
          stageId,
          input.company_name.trim(),
          input.contact_name?.trim() ?? "",
          JSON.stringify(asStringList(input.secretaries)),
          JSON.stringify(asStringList(input.phones)),
          input.notes?.trim() ?? "",
          Number(count.rows[0]?.n ?? 0),
        ],
      );
      return loadCard(q, String(inserted.rows[0]!.id));
    });
  },

  async updateCrmDeal(
    userId: string,
    dealId: string,
    patch: CrmDealPatch,
  ): Promise<CrmDealCard | null> {
    return withTransaction(async (q) => {
      const deal = await ownedDeal(q, userId, dealId);
      if (!deal) return null;
      await q(
        `update crm_deals
            set company_name = coalesce($2, company_name),
                contact_name = coalesce($3, contact_name),
                secretaries = coalesce($4::jsonb, secretaries),
                phones = coalesce($5::jsonb, phones),
                notes = coalesce($6, notes),
                updated_at = now()
          where id = $1`,
        [
          dealId,
          patch.company_name ?? null,
          patch.contact_name ?? null,
          patch.secretaries ? JSON.stringify(asStringList(patch.secretaries)) : null,
          patch.phones ? JSON.stringify(asStringList(patch.phones)) : null,
          patch.notes ?? null,
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

  async logCrmCall(
    userId: string,
    dealId: string,
    notes: string,
    next?: CrmNextAction | null,
  ): Promise<CrmDealCard | null> {
    return withTransaction(async (q) => {
      if (!(await ownedDeal(q, userId, dealId))) return null;
      await q(
        `update crm_deals set notes = $2, updated_at = now() where id = $1`,
        [dealId, notes],
      );
      await closeOpen(q, dealId);
      if (next) await insertOpen(q, dealId, next.kind, next.dueAt);
      return loadCard(q, dealId);
    });
  },
};
