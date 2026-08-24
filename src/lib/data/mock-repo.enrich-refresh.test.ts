import { afterEach, describe, expect, it } from "vitest";
import { mockRepo } from "./mock-repo";
import { getMockStore } from "./mock-store";

const USER = "enrich-refresh-user";

describe("enqueueEnrichment refresh (force)", () => {
  afterEach(() => {
    const store = getMockStore();
    store.enrichment_jobs = store.enrichment_jobs.filter(
      (j) => j.requested_by !== USER,
    );
  });

  it("skips fresh complete enrichment without force", async () => {
    const store = getMockStore();
    const fresh = store.lead_enrichment.find((e) => e.stage === "complete");
    expect(fresh).toBeTruthy();
    const cnpj = fresh!.cnpj;

    const result = await mockRepo.enqueueEnrichment({
      cnpjs: [cnpj],
      userId: USER,
      searchId: null,
    });

    expect(result.queued).toBe(0);
    const job = store.enrichment_jobs.find(
      (j) => j.cnpj === cnpj && j.requested_by === USER,
    );
    expect(job?.status).toBe("skipped");
  });

  it("queues a pending job when force+refresh on fresh complete", async () => {
    const store = getMockStore();
    const fresh = store.lead_enrichment.find((e) => e.stage === "complete");
    expect(fresh).toBeTruthy();
    const cnpj = fresh!.cnpj;
    const beforeStage = fresh!.stage;
    const beforeCollected = fresh!.collected_at;

    const result = await mockRepo.enqueueEnrichment({
      cnpjs: [cnpj],
      userId: USER,
      searchId: null,
      force: true,
      payload: { force: true, refresh: true },
    });

    expect(result.queued).toBe(1);
    const job = store.enrichment_jobs.find(
      (j) => j.cnpj === cnpj && j.requested_by === USER,
    );
    expect(job?.status).toBe("pending");
    expect(job?.payload).toEqual({ force: true, refresh: true });
    // Enqueue alone must not clear the prior complete audit.
    const still = store.lead_enrichment.find((e) => e.cnpj === cnpj);
    expect(still?.stage).toBe(beforeStage);
    expect(still?.collected_at).toBe(beforeCollected);
  });
});
