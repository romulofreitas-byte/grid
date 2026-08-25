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
});
