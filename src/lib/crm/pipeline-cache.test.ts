import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CRM_BOARD_CACHE_TTL_MS,
  createLatestPrefetch,
  dedupeInflight,
  isBoardCacheFresh,
} from "./pipeline-cache";

describe("pipeline board cache", () => {
  it("treats a missing timestamp as stale", () => {
    expect(isBoardCacheFresh(undefined)).toBe(false);
  });

  it("keeps a board fresh inside the TTL and stale after", () => {
    const fetchedAt = 1_000;
    expect(isBoardCacheFresh(fetchedAt, fetchedAt + CRM_BOARD_CACHE_TTL_MS - 1)).toBe(
      true,
    );
    expect(isBoardCacheFresh(fetchedAt, fetchedAt + CRM_BOARD_CACHE_TTL_MS)).toBe(
      false,
    );
  });

  it("reuses the in-flight promise for the same pipeline", async () => {
    const inflight = new Map<string, Promise<string>>();
    let starts = 0;
    const first = dedupeInflight(inflight, "p1", async () => {
      starts += 1;
      return "board";
    });
    const second = dedupeInflight(inflight, "p1", async () => {
      starts += 1;
      return "other";
    });
    expect(starts).toBe(1);
    await expect(Promise.all([first, second])).resolves.toEqual(["board", "board"]);
    expect(inflight.size).toBe(0);
  });
});

describe("createLatestPrefetch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs only the last hovered id after the delay", async () => {
    vi.useFakeTimers();
    const ran: string[] = [];
    const prefetch = createLatestPrefetch({
      delayMs: 280,
      isFresh: () => false,
      run: async (id) => {
        ran.push(id);
      },
    });
    prefetch.hover("a");
    prefetch.hover("b");
    prefetch.hover("c");
    await vi.advanceTimersByTimeAsync(280);
    expect(ran).toEqual(["c"]);
  });

  it("skips a fresh id and queues only the latest while one run is in flight", async () => {
    vi.useFakeTimers();
    let resolveFirst!: () => void;
    const ran: string[] = [];
    const prefetch = createLatestPrefetch({
      delayMs: 10,
      isFresh: (id) => id === "fresh",
      run: (id) => {
        ran.push(id);
        if (id === "a") {
          return new Promise<void>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve();
      },
    });
    prefetch.hover("fresh");
    await vi.advanceTimersByTimeAsync(10);
    expect(ran).toEqual([]);

    prefetch.hover("a");
    await vi.advanceTimersByTimeAsync(10);
    expect(ran).toEqual(["a"]);

    prefetch.hover("b");
    prefetch.hover("c");
    resolveFirst();
    await vi.advanceTimersByTimeAsync(10);
    expect(ran).toEqual(["a", "c"]);
  });
});

