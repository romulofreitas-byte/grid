import { CATCHUP_BATCH_SIZE, CRM_QUALIFY_BRIDGE_TASK } from "@/lib/catchup/constants";
import type { CatchUpRunResult, CatchUpTask } from "@/lib/catchup/types";
import { crmAllowed } from "@/lib/billing/service";
import { bridgeQualifiedLeadsToCrm } from "@/lib/crm/bridge";
import type { GridRepo } from "@/lib/data/repo";

export type QualifyBridgeRepo = Pick<
  GridRepo,
  | "listCatchUpQualifiedCnpjs"
  | "getSearch"
  | "listCrmPipelines"
  | "createCrmPipeline"
  | "findCrmDealByCnpj"
  | "createCrmDeal"
  | "getDossier"
  | "getPreset"
  | "listCompanyBriefs"
>;

export async function runCrmQualifyBridge(
  repo: QualifyBridgeRepo,
  userId: string,
  opts?: { searchId?: string; cnpjs?: string[] },
): Promise<CatchUpRunResult> {
  if (!(await crmAllowed(userId))) {
    return { created: 0, skipped: 0, hasMore: false };
  }
  if (opts?.searchId && opts.cnpjs?.length) {
    const search = await repo.getSearch(opts.searchId);
    if (!search || search.user_id !== userId || !search.saved) {
      return { created: 0, skipped: 0, hasMore: false };
    }
    const out = await bridgeQualifiedLeadsToCrm(repo, {
      userId,
      search,
      cnpjs: opts.cnpjs,
      source: "catchup_bridge",
    });
    return {
      created: out.created,
      skipped: out.skipped,
      hasMore: false,
      pipelineId: out.pipelineId,
      pipelineNome: out.pipelineNome,
    };
  }

  const limit = CATCHUP_BATCH_SIZE + 1;
  const rows = await repo.listCatchUpQualifiedCnpjs(userId, {
    searchId: opts?.searchId,
    limit,
  });
  const hasMore = rows.length > CATCHUP_BATCH_SIZE;
  const batch = hasMore ? rows.slice(0, CATCHUP_BATCH_SIZE) : rows;
  const bySearch = new Map<string, string[]>();
  for (const row of batch) {
    const list = bySearch.get(row.searchId) ?? [];
    list.push(row.cnpj);
    bySearch.set(row.searchId, list);
  }

  let created = 0;
  let skipped = 0;
  let pipelineId: string | null = null;
  let pipelineNome: string | null = null;
  for (const [searchId, cnpjs] of bySearch) {
    const search = await repo.getSearch(searchId);
    if (!search || !search.saved) {
      skipped += cnpjs.length;
      continue;
    }
    const out = await bridgeQualifiedLeadsToCrm(repo, {
      userId,
      search,
      cnpjs,
      source: "catchup_bridge",
    });
    created += out.created;
    skipped += out.skipped;
    if (out.pipelineId && !pipelineId) {
      pipelineId = out.pipelineId;
      pipelineNome = out.pipelineNome;
    }
  }
  return { created, skipped, hasMore, pipelineId, pipelineNome };
}

export const crmQualifyBridgeTask: CatchUpTask = {
  id: CRM_QUALIFY_BRIDGE_TASK,
  mode: "reconcile",
  run(userId, repo) {
    return runCrmQualifyBridge(repo, userId);
  },
};
