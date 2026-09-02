import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockRepo } from "./mock-repo";
import { getMockStore } from "./mock-store";
import type { EnrichmentJob } from "@/lib/types";

const USER = "enrich-priority-user";

function pendingJob(patch: Partial<EnrichmentJob> & Pick<EnrichmentJob, "id" | "cnpj">): EnrichmentJob {
  return {
    requested_by: USER,
    search_id: "s-priority",
    status: "pending",
    attempts: 0,
    last_error: null,
    locked_at: null,
    created_at: "2026-09-02T12:00:00.000Z",
    finished_at: null,
    payload: null,
    priority: 0,
    ...patch,
  };
}

describe("claimEnrichmentJob priority", () => {
  let previous: EnrichmentJob[] = [];

  beforeEach(() => {
    const store = getMockStore();
    previous = store.enrichment_jobs;
    store.enrichment_jobs = [];
  });

  afterEach(() => {
    getMockStore().enrichment_jobs = previous;
  });

  it("claims a newer priority job before an older bulk job", async () => {
    const store = getMockStore();
    store.enrichment_jobs.push(
      pendingJob({
        id: 9001,
        cnpj: "00000000000001",
        created_at: "2026-09-02T10:00:00.000Z",
        priority: 0,
      }),
      pendingJob({
        id: 9002,
        cnpj: "00000000000002",
        created_at: "2026-09-02T12:00:00.000Z",
        priority: 1,
      }),
    );

    const claimed = await mockRepo.claimEnrichmentJob();
    expect(claimed?.cnpj).toBe("00000000000002");
    expect(claimed?.priority).toBe(1);
  });

  it("stores priority 1 for interactive enqueue", async () => {
    const store = getMockStore();
    const cnpj = "00000000000999";
    store.lead_enrichment = store.lead_enrichment.filter((e) => e.cnpj !== cnpj);
    await mockRepo.enqueueEnrichment({
      cnpjs: [cnpj],
      userId: USER,
      searchId: null,
      priority: true,
    });
    const job = store.enrichment_jobs.find(
      (j) => j.cnpj === cnpj && j.requested_by === USER,
    );
    expect(job?.priority).toBe(1);
  });

  it("claims this search's job instead of an older global pending job", async () => {
    const store = getMockStore();
    store.enrichment_jobs.push(
      pendingJob({
        id: 9101,
        cnpj: "00000000000001",
        search_id: "other-search",
        created_at: "2026-09-02T10:00:00.000Z",
        priority: 0,
      }),
      pendingJob({
        id: 9102,
        cnpj: "00000000000002",
        search_id: "s-priority",
        created_at: "2026-09-02T12:00:00.000Z",
        priority: 1,
      }),
    );
    const claimed = await mockRepo.claimEnrichmentJob({
      searchId: "s-priority",
      requestedBy: USER,
    });
    expect(claimed?.cnpj).toBe("00000000000002");
  });
});
