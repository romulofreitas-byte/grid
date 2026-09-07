import { describe, expect, it } from "vitest";
import {
  LAST_CRM_PIPELINE_COOKIE,
  lastCrmPipelineCookie,
  parseLastCrmPipelineId,
  readLastCrmPipelineId,
  resolveCrmPipeline,
} from "./last-pipeline";

const PIPE_A = "a1000000-0000-4000-8000-000000000001";
const PIPE_B = "b1000000-0000-4000-8000-000000000002";
const PIPE_GONE = "c1000000-0000-4000-8000-000000000003";

const pipelines = [
  { id: PIPE_A, deal_count: 0 },
  { id: PIPE_B, deal_count: 4 },
];

describe("last CRM pipeline cookie", () => {
  it("reads a valid uuid from a header", () => {
    expect(
      readLastCrmPipelineId(`a=1; ${LAST_CRM_PIPELINE_COOKIE}=${PIPE_A}; b=2`),
    ).toBe(PIPE_A);
    expect(readLastCrmPipelineId(null)).toBeNull();
  });

  it("ignores invalid cookie values", () => {
    expect(parseLastCrmPipelineId("not-a-uuid")).toBeNull();
    expect(parseLastCrmPipelineId("")).toBeNull();
    expect(parseLastCrmPipelineId(undefined)).toBeNull();
    expect(
      readLastCrmPipelineId(`${LAST_CRM_PIPELINE_COOKIE}=not-a-uuid`),
    ).toBeNull();
  });

  it("sets and clears the cookie", () => {
    expect(lastCrmPipelineCookie(PIPE_A)).toContain(
      `${LAST_CRM_PIPELINE_COOKIE}=${PIPE_A}`,
    );
    expect(lastCrmPipelineCookie(null)).toMatch(/Max-Age=0/);
  });
});

describe("resolveCrmPipeline", () => {
  it("prefers a requested pipeline that still exists", () => {
    expect(resolveCrmPipeline(pipelines, PIPE_A, PIPE_B)?.id).toBe(PIPE_A);
  });

  it("uses the remembered pipeline when the query is missing or gone", () => {
    expect(resolveCrmPipeline(pipelines, null, PIPE_A)?.id).toBe(PIPE_A);
    expect(resolveCrmPipeline(pipelines, PIPE_GONE, PIPE_A)?.id).toBe(PIPE_A);
  });

  it("falls back to the busiest pipeline when memory is gone", () => {
    expect(resolveCrmPipeline(pipelines, PIPE_GONE, PIPE_GONE)?.id).toBe(PIPE_B);
    expect(resolveCrmPipeline(pipelines)?.id).toBe(PIPE_B);
  });
});
