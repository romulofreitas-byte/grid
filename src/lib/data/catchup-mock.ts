import { listMemoryBilledCnpjs } from "@/lib/billing/memory-store";
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
import { digitsCnpj } from "@/lib/crm/bridge";
import { getMockStore, type MockStore } from "@/lib/data/mock-store";

const QUALIFIED_JOB = new Set(["pending", "running", "done", "skipped"]);

type CatchUpRow = {
  user_id: string;
  task_id: string;
  status: "idle" | "running";
  last_ran_at: string | null;
  has_more: boolean;
};

function catchupRows(store: MockStore): CatchUpRow[] {
  return store.user_catchup_state;
}

function isQualified(store: MockStore, userId: string, searchId: string, cnpj: string) {
  const digits = digitsCnpj(cnpj);
  const billed = new Set([
    ...store.billed_cnpjs
      .filter((row) => row.profile_id === userId && row.kind === "enrich")
      .map((row) => digitsCnpj(row.cnpj)),
    ...listMemoryBilledCnpjs(userId, "enrich").map(digitsCnpj),
  ]);
  if (billed.has(digits)) return true;
  if (
    store.enrichment_jobs.some(
      (job) =>
        job.search_id === searchId &&
        digitsCnpj(job.cnpj) === digits &&
        QUALIFIED_JOB.has(job.status),
    )
  ) {
    return true;
  }
  return false;
}

function inCrm(store: MockStore, userId: string, cnpj: string): boolean {
  const digits = digitsCnpj(cnpj);
  return store.crm_deals.some((deal) => {
    if (!deal.cnpj || digitsCnpj(deal.cnpj) !== digits) return false;
    return store.crm_pipelines.some(
      (pipeline) => pipeline.id === deal.pipeline_id && pipeline.user_id === userId,
    );
  });
}

export const catchupMockMethods = {
  async listCatchUpQualifiedCnpjs(
    userId: string,
    opts?: { searchId?: string; limit?: number },
  ): Promise<CatchUpCandidate[]> {
    const store = getMockStore();
    const limit = Math.max(1, opts?.limit ?? CATCHUP_BATCH_SIZE);
    const searches = store.searches
      .filter(
        (search) =>
          search.user_id === userId &&
          search.saved &&
          (!opts?.searchId || search.id === opts.searchId),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const out: CatchUpCandidate[] = [];
    for (const search of searches) {
      const leads = store.saved_leads
        .filter((lead) => lead.search_id === search.id)
        .sort((a, b) => a.grid_position - b.grid_position);
      for (const lead of leads) {
        const cnpj = digitsCnpj(lead.cnpj);
        if (!isQualified(store, userId, search.id, cnpj)) continue;
        if (inCrm(store, userId, cnpj)) continue;
        out.push({ searchId: search.id, cnpj });
        if (out.length >= limit) return out;
      }
    }
    return out;
  },

  async tryBeginCatchUp(
    userId: string,
    taskId: string,
  ): Promise<CatchUpLockResult> {
    const store = getMockStore();
    const rows = catchupRows(store);
    let row = rows.find((entry) => entry.user_id === userId && entry.task_id === taskId);
    const now = Date.now();
    if (row) {
      const lastRan = row.last_ran_at ? Date.parse(row.last_ran_at) : 0;
      if (
        row.status === "idle" &&
        !row.has_more &&
        lastRan > 0 &&
        now - lastRan < CATCHUP_COOLDOWN_MS
      ) {
        return "cooldown";
      }
      if (
        row.status === "running" &&
        lastRan > 0 &&
        now - lastRan < CATCHUP_STALE_MS
      ) {
        return "busy";
      }
    } else {
      row = {
        user_id: userId,
        task_id: taskId,
        status: "idle",
        last_ran_at: null,
        has_more: false,
      };
      rows.push(row);
    }
    row.status = "running";
    row.last_ran_at = new Date(now).toISOString();
    return "ok";
  },

  async finishCatchUp(
    userId: string,
    taskId: string,
    result: CatchUpRunResult,
  ): Promise<void> {
    const store = getMockStore();
    const rows = catchupRows(store);
    let row = rows.find((entry) => entry.user_id === userId && entry.task_id === taskId);
    if (!row) {
      row = {
        user_id: userId,
        task_id: taskId,
        status: "idle",
        last_ran_at: null,
        has_more: false,
      };
      rows.push(row);
    }
    row.status = "idle";
    row.has_more = result.hasMore;
    row.last_ran_at = new Date().toISOString();
  },
};
