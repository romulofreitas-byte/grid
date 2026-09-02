import { describe, expect, it } from "vitest";
import {
  SEARCH_JOB_DONE_REUSE_MINUTES,
  SEARCH_JOB_LIVE_REUSE_MINUTES,
  SEARCH_JOB_POLL_MS,
  searchJobConcurrency,
  searchJobQueuePosition,
  shouldRunSearchJobsInline,
  toSearchJobPublic,
} from "./search-jobs";
import { DEFAULT_FILTERS } from "@/lib/types";
import type { SearchJob } from "./search-jobs";

function job(over: Partial<SearchJob> = {}): SearchJob {
  return {
    id: "j1",
    user_id: "u1",
    nome: "Lista",
    filtros: DEFAULT_FILTERS,
    status: "pending",
    search_id: null,
    error: null,
    attempts: 0,
    locked_at: null,
    created_at: "2026-08-24T12:00:00.000Z",
    finished_at: null,
    ...over,
  };
}

describe("searchJobQueuePosition", () => {
  it("is 1-based for pending jobs and 0 once running", () => {
    expect(searchJobQueuePosition(0, "pending")).toBe(1);
    expect(searchJobQueuePosition(3, "pending")).toBe(4);
    expect(searchJobQueuePosition(3, "running")).toBe(0);
    expect(searchJobQueuePosition(3, "done")).toBe(0);
  });
});

describe("toSearchJobPublic", () => {
  it("exposes queue fields without leaking the raw row", () => {
    const publicJob = toSearchJobPublic(job(), 2);
    expect(publicJob.jobId).toBe("j1");
    expect(publicJob.queuePosition).toBe(3);
    expect(publicJob.search).toBeNull();
  });
});

describe("shouldRunSearchJobsInline", () => {
  it("runs inline on mock and skips Vercel", () => {
    const prevSource = process.env.DATA_SOURCE;
    const prevVercel = process.env.VERCEL;
    try {
      process.env.DATA_SOURCE = "mock";
      delete process.env.VERCEL;
      expect(shouldRunSearchJobsInline()).toBe(true);
      process.env.DATA_SOURCE = "postgres";
      process.env.VERCEL = "1";
      expect(shouldRunSearchJobsInline()).toBe(false);
    } finally {
      if (prevSource == null) delete process.env.DATA_SOURCE;
      else process.env.DATA_SOURCE = prevSource;
      if (prevVercel == null) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
    }
  });
});

describe("searchJobConcurrency", () => {
  it("defaults to 2 and clamps", () => {
    expect(searchJobConcurrency(undefined)).toBe(2);
    expect(searchJobConcurrency("0")).toBe(2);
    expect(searchJobConcurrency("3")).toBe(3);
    expect(searchJobConcurrency("99")).toBe(8);
  });
});

describe("search job timing", () => {
  it("polls and reuses done jobs on a short window", () => {
    expect(SEARCH_JOB_POLL_MS).toBe(400);
    expect(SEARCH_JOB_LIVE_REUSE_MINUTES).toBe(2);
    expect(SEARCH_JOB_DONE_REUSE_MINUTES).toBe(10);
  });
});
