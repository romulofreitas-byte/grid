import { describe, expect, it, vi } from "vitest";
import {
  invalidateLiveStats,
  LIVE_STATS_KEYS,
  LIVE_STATS_QUERY_OPTIONS,
  originateCallJobsActive,
  originateCallJobsPollInterval,
} from "./live-stats";

describe("invalidateLiveStats", () => {
  it("invalidates each live stats family", async () => {
    const invalidateQueries = vi.fn(async () => undefined);
    await invalidateLiveStats({ invalidateQueries });
    expect(invalidateQueries.mock.calls.map((call) => call[0]?.queryKey)).toEqual(
      LIVE_STATS_KEYS.map((key) => [key]),
    );
  });

  it("keeps focus refetch only on the live stats queries", () => {
    expect(LIVE_STATS_QUERY_OPTIONS).toEqual({
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnMount: "always",
    });
  });
});

describe("originate call job poll", () => {
  it("polls only while an originate job is in flight", () => {
    expect(
      originateCallJobsActive([
        { verb: "push_list", status: "running" },
        { verb: "originate_call", status: "done" },
      ]),
    ).toBe(false);
    expect(
      originateCallJobsPollInterval([
        { verb: "originate_call", status: "pending" },
      ]),
    ).toBe(3000);
    expect(
      originateCallJobsPollInterval([
        { verb: "originate_call", status: "running" },
      ]),
    ).toBe(3000);
    expect(
      originateCallJobsPollInterval([{ verb: "originate_call", status: "done" }]),
    ).toBe(false);
  });
});
