import { describe, expect, it } from "vitest";
import {
  compareEnrichmentClaimOrder,
  enrichJobPriority,
  isInteractiveEnrichScope,
  latestEnrichmentJobPerCnpj,
} from "./jobs";
import type { EnrichmentJob } from "@/lib/types";

function job(
  patch: Partial<EnrichmentJob> & Pick<EnrichmentJob, "id" | "cnpj">,
): EnrichmentJob {
  return {
    requested_by: "u1",
    search_id: "s1",
    status: "pending",
    attempts: 0,
    last_error: null,
    locked_at: null,
    created_at: "2026-09-02T12:00:00.000Z",
    finished_at: null,
    priority: 0,
    ...patch,
  };
}

describe("enrich job priority", () => {
  it("treats first_unaudited and seleção as interactive", () => {
    expect(isInteractiveEnrichScope("first_unaudited")).toBe(true);
    expect(isInteractiveEnrichScope(undefined)).toBe(true);
    expect(isInteractiveEnrichScope("all_unaudited")).toBe(false);
    expect(enrichJobPriority(true)).toBe(1);
    expect(enrichJobPriority(false)).toBe(0);
  });

  it("claims interactive jobs ahead of older bulk jobs", () => {
    const bulk = job({
      id: 1,
      cnpj: "1",
      created_at: "2026-09-02T11:00:00.000Z",
      priority: 0,
    });
    const interactive = job({
      id: 2,
      cnpj: "2",
      created_at: "2026-09-02T12:00:00.000Z",
      priority: 1,
    });
    expect([bulk, interactive].sort(compareEnrichmentClaimOrder)[0]?.id).toBe(2);
  });

  it("keeps FIFO among the same priority", () => {
    const older = job({
      id: 1,
      cnpj: "1",
      created_at: "2026-09-02T11:00:00.000Z",
      priority: 1,
    });
    const newer = job({
      id: 2,
      cnpj: "2",
      created_at: "2026-09-02T12:00:00.000Z",
      priority: 1,
    });
    expect([newer, older].sort(compareEnrichmentClaimOrder)[0]?.id).toBe(1);
  });

  it("keeps the newest job per CNPJ", () => {
    const jobs = [
      job({
        id: 1,
        cnpj: "111",
        created_at: "2026-09-02T11:00:00.000Z",
        status: "done",
      }),
      job({
        id: 2,
        cnpj: "111",
        created_at: "2026-09-02T12:00:00.000Z",
        status: "pending",
      }),
      job({
        id: 3,
        cnpj: "222",
        created_at: "2026-09-02T10:00:00.000Z",
        status: "done",
      }),
    ];
    const latest = latestEnrichmentJobPerCnpj(jobs);
    expect(latest).toHaveLength(2);
    expect(latest.find((j) => j.cnpj === "111")?.id).toBe(2);
    expect(latest.find((j) => j.cnpj === "222")?.id).toBe(3);
  });
});
