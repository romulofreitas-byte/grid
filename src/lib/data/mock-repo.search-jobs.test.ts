import { describe, expect, it } from "vitest";
import { mockRepo } from "@/lib/data/mock-repo";
import { getMockStore } from "@/lib/data/mock-store";
import { drainSearchJobs } from "@/lib/enrichment/process-job";
import { LOCAL_USER_ID } from "@/lib/data/pg";
import { DEFAULT_FILTERS } from "@/lib/types";

describe("mock search jobs", () => {
  it("enqueues, reuses the same filters, and drains into a search", async () => {
    const store = getMockStore();
    store.search_jobs = [];
    const filters = { ...DEFAULT_FILTERS, ufs: ["MG"] };
    const first = await mockRepo.enqueueSearchJob(LOCAL_USER_ID, "Lista · MG", filters);
    const reused = await mockRepo.findReusableSearchJob(LOCAL_USER_ID, filters);
    expect(reused?.id).toBe(first.id);
    expect(await mockRepo.countSearchJobsAhead(first)).toBe(0);

    const processed = await drainSearchJobs(1);
    expect(processed).toBe(1);
    const done = await mockRepo.getSearchJob(first.id, LOCAL_USER_ID);
    expect(done?.status).toBe("done");
    expect(done?.search_id).toBeTruthy();
    const search = await mockRepo.getSearch(done!.search_id!);
    expect(search?.user_id).toBe(LOCAL_USER_ID);
  });

  it("reuses a recent done job with the same filters and prefers pending", async () => {
    const store = getMockStore();
    store.search_jobs = [];
    const filters = { ...DEFAULT_FILTERS, ufs: ["PA"] };
    const search = await mockRepo.runSearch(LOCAL_USER_ID, "Lista · PA", filters);
    const done = await mockRepo.recordDoneSearchJob(
      LOCAL_USER_ID,
      "Lista · PA",
      filters,
      search.id,
    );
    const reused = await mockRepo.findReusableSearchJob(LOCAL_USER_ID, filters);
    expect(reused?.id).toBe(done.id);
    expect(reused?.status).toBe("done");
    expect(reused?.search_id).toBe(search.id);

    const pending = await mockRepo.enqueueSearchJob(
      LOCAL_USER_ID,
      "Lista · PA de novo",
      filters,
    );
    const live = await mockRepo.findReusableSearchJob(LOCAL_USER_ID, filters);
    expect(live?.id).toBe(pending.id);
    expect(live?.status).toBe("pending");
  });

  it("does not reuse a done job older than the reuse window", async () => {
    const store = getMockStore();
    store.search_jobs = [];
    const filters = { ...DEFAULT_FILTERS, ufs: ["CE"] };
    const search = await mockRepo.runSearch(LOCAL_USER_ID, "Lista · CE", filters);
    const done = await mockRepo.recordDoneSearchJob(
      LOCAL_USER_ID,
      "Lista · CE",
      filters,
      search.id,
    );
    done.finished_at = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    expect(await mockRepo.findReusableSearchJob(LOCAL_USER_ID, filters)).toBeNull();
  });

  it("stores CNPJs on a small full count", async () => {
    const filters = { ...DEFAULT_FILTERS, ufs: ["MG"] };
    const result = await mockRepo.count(filters, "full");
    expect(result.capped).toBe(false);
    if (result.total > 0) {
      expect(result.cnpjs).toHaveLength(result.total);
      expect(await mockRepo.hasCachedSearchCandidates(filters)).toBe(true);
    } else {
      expect(await mockRepo.hasCachedSearchCandidates(filters)).toBe(false);
    }
  });
});
