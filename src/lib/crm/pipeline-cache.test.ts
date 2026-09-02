import { describe, expect, it } from "vitest";
import {
  CRM_BOARD_CACHE_TTL_MS,
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
