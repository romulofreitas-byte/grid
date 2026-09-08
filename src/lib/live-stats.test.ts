import { describe, expect, it, vi } from "vitest";
import {
  BOX_QUEUE_QUERY_KEY,
  invalidateLiveStats,
  LIVE_STATS_KEYS,
  LIVE_STATS_QUERY_OPTIONS,
  originateCallJobsActive,
  originateCallJobsPollInterval,
  replaceQueryIfSnapshotChanged,
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

  it("puts the box queue in the live stats family", () => {
    expect(LIVE_STATS_KEYS).toContain("box-queue");
    expect(BOX_QUEUE_QUERY_KEY).toEqual(["box-queue"]);
  });
});

describe("replaceQueryIfSnapshotChanged", () => {
  it("writes only when the snapshot identity changes", () => {
    const setQueryData = vi.fn();
    const last = { current: null as { n: number } | null };
    const first = { n: 1 };
    const second = { n: 2 };
    replaceQueryIfSnapshotChanged({ setQueryData }, BOX_QUEUE_QUERY_KEY, first, last);
    replaceQueryIfSnapshotChanged({ setQueryData }, BOX_QUEUE_QUERY_KEY, first, last);
    replaceQueryIfSnapshotChanged({ setQueryData }, BOX_QUEUE_QUERY_KEY, second, last);
    expect(setQueryData.mock.calls).toEqual([
      [BOX_QUEUE_QUERY_KEY, first],
      [BOX_QUEUE_QUERY_KEY, second],
    ]);
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
