import { describe, expect, it } from "vitest";
import {
  ENRICH_JOB_POLL_PENDING_MS,
  ENRICH_JOB_POLL_RUNNING_MS,
  enrichJobsPollInterval,
  enrichQueueStuck,
  isGridRowQualified,
  isGridRowQualifying,
} from "./grid-qualify";
import type { EnrichmentJob } from "@/lib/types";

describe("grid qualify badge", () => {
  it("does not show Qualificado while billed and the job is still running", () => {
    const row = {
      cnpj: "12345678000190",
      hasAudit: true,
      enrichmentStatus: "running" as const,
    };
    const qualifying = isGridRowQualifying(row, new Set());
    expect(qualifying).toBe(true);
    expect(isGridRowQualified(row, qualifying)).toBe(false);
  });

  it("treats billed-without-job as still cruzando until a complete audit exists", () => {
    const row = {
      cnpj: "12345678000190",
      hasAudit: true,
      enrichmentStatus: null,
    };
    const qualifying = isGridRowQualifying(row, new Set());
    expect(qualifying).toBe(true);
    expect(isGridRowQualified(row, qualifying)).toBe(false);
  });

  it("shows Qualificado only after the job finishes", () => {
    const row = {
      cnpj: "12345678000190",
      hasAudit: true,
      enrichmentStatus: "done" as const,
    };
    const qualifying = isGridRowQualifying(row, new Set());
    expect(qualifying).toBe(false);
    expect(isGridRowQualified(row, qualifying)).toBe(true);
  });
});

describe("enrich job poll", () => {
  const job = (status: EnrichmentJob["status"]): EnrichmentJob => ({
    id: 1,
    cnpj: "1",
    requested_by: null,
    search_id: "s1",
    status,
    attempts: 0,
    last_error: null,
    locked_at: null,
    created_at: "2026-09-02T12:00:00.000Z",
    finished_at: null,
  });

  it("polls faster while a job is running", () => {
    expect(enrichJobsPollInterval([job("running")])).toBe(
      ENRICH_JOB_POLL_RUNNING_MS,
    );
    expect(enrichJobsPollInterval([job("pending")])).toBe(
      ENRICH_JOB_POLL_PENDING_MS,
    );
    expect(enrichJobsPollInterval([job("done")])).toBe(false);
  });

  it("flags a stuck queue after 15s of pending-only", () => {
    const jobs = [job("pending")];
    expect(enrichQueueStuck(jobs, Date.now(), Date.now() + 1_000)).toBe(false);
    expect(enrichQueueStuck(jobs, Date.now() - 16_000, Date.now())).toBe(true);
    expect(enrichQueueStuck([job("running")], Date.now() - 16_000, Date.now())).toBe(
      false,
    );
  });
});
