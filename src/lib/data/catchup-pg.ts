import {
  CATCHUP_BATCH_SIZE,
  CATCHUP_COOLDOWN_MS,
  CATCHUP_STALE_MS,
} from "@/lib/catchup/constants";
import type {
  CatchUpCandidate,
  CatchUpLockResult,
  CatchUpRunResult,
} from "@/lib/catchup/types";
import { isUndefinedTableError, query } from "@/lib/data/pg";

const QUALIFIED_JOB_STATUSES = "('pending','running','done','skipped')";

export const catchupPgMethods = {
  async listCatchUpQualifiedCnpjs(
    userId: string,
    opts?: { searchId?: string; limit?: number },
  ): Promise<CatchUpCandidate[]> {
    const limit = Math.max(1, opts?.limit ?? CATCHUP_BATCH_SIZE);
    const params: unknown[] = [userId];
    let searchFilter = "";
    if (opts?.searchId) {
      params.push(opts.searchId);
      searchFilter = `and s.id = $${params.length}`;
    }
    params.push(limit);
    const limitParam = `$${params.length}`;
    try {
      const { rows } = await query<{ search_id: string; cnpj: string }>(
        `select sl.search_id, rtrim(sl.cnpj) as cnpj
           from saved_leads sl
           join searches s on s.id = sl.search_id
          where s.user_id = $1
            and s.saved = true
            ${searchFilter}
            and (
              exists (
                select 1 from billed_cnpjs b
                 where b.profile_id = $1
                   and rtrim(b.cnpj) = rtrim(sl.cnpj)
                   and b.kind = 'enrich'
              )
              or exists (
                select 1 from enrichment_jobs j
                 where j.search_id = sl.search_id
                   and rtrim(j.cnpj) = rtrim(sl.cnpj)
                   and j.status in ${QUALIFIED_JOB_STATUSES}
              )
            )
            and not exists (
              select 1 from crm_deals d
              join crm_pipelines p on p.id = d.pipeline_id
               where p.user_id = $1
                 and d.cnpj is not null
                 and rtrim(d.cnpj) = rtrim(sl.cnpj)
            )
          order by s.created_at, sl.grid_position
          limit ${limitParam}`,
        params,
      );
      return rows.map((row) => ({
        searchId: String(row.search_id),
        cnpj: String(row.cnpj).replace(/\D/g, "").padStart(14, "0"),
      }));
    } catch (err) {
      if (isUndefinedTableError(err)) return [];
      throw err;
    }
  },

  async tryBeginCatchUp(
    userId: string,
    taskId: string,
  ): Promise<CatchUpLockResult> {
    try {
      const current = await query<{
        status: string;
        last_ran_at: Date | string | null;
        has_more: boolean;
      }>(
        `select status, last_ran_at, has_more
           from user_catchup_state
          where user_id = $1 and task_id = $2`,
        [userId, taskId],
      );
      const row = current.rows[0];
      if (row) {
        const lastRan = row.last_ran_at
          ? new Date(row.last_ran_at).getTime()
          : 0;
        if (
          row.status === "idle" &&
          !row.has_more &&
          lastRan > 0 &&
          Date.now() - lastRan < CATCHUP_COOLDOWN_MS
        ) {
          return "cooldown";
        }
      }

      const locked = await query(
        `insert into user_catchup_state (user_id, task_id, status, last_ran_at)
         values ($1, $2, 'running', now())
         on conflict (user_id, task_id) do update
            set status = 'running',
                last_ran_at = now()
          where user_catchup_state.status = 'idle'
             or user_catchup_state.last_ran_at < now() - ($3::int * interval '1 millisecond')
         returning user_id`,
        [userId, taskId, CATCHUP_STALE_MS],
      );
      return locked.rows[0] ? "ok" : "busy";
    } catch (err) {
      if (isUndefinedTableError(err)) return "ok";
      throw err;
    }
  },

  async finishCatchUp(
    userId: string,
    taskId: string,
    result: CatchUpRunResult,
  ): Promise<void> {
    try {
      await query(
        `insert into user_catchup_state (
           user_id, task_id, status, last_ran_at, has_more, last_result
         ) values ($1, $2, 'idle', now(), $3, $4::jsonb)
         on conflict (user_id, task_id) do update
            set status = 'idle',
                last_ran_at = now(),
                has_more = excluded.has_more,
                last_result = excluded.last_result`,
        [
          userId,
          taskId,
          result.hasMore,
          JSON.stringify({
            created: result.created,
            skipped: result.skipped,
          }),
        ],
      );
    } catch (err) {
      if (isUndefinedTableError(err)) return;
      throw err;
    }
  },
};
