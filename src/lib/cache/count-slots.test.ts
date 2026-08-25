import { afterEach, describe, expect, it } from "vitest";
import {
  COUNT_INFLIGHT_MAX,
  resetCountSlotsForTests,
  tryAcquireCountLock,
  tryAcquireCountSlot,
  releaseCountLock,
  releaseCountSlot,
  withCountSingleFlight,
} from "./count-slots";

afterEach(() => {
  resetCountSlotsForTests();
});

describe("count slots", () => {
  it("caps inflight acquires", async () => {
    const got: boolean[] = [];
    for (let i = 0; i < COUNT_INFLIGHT_MAX + 2; i += 1) {
      got.push(await tryAcquireCountSlot());
    }
    expect(got.filter(Boolean)).toHaveLength(COUNT_INFLIGHT_MAX);
    await releaseCountSlot();
    expect(await tryAcquireCountSlot()).toBe(true);
  });

  it("lets the leader run and waiters reuse the result", async () => {
    let runs = 0;
    let value: number | null = null;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const leader = withCountSingleFlight(
      "k",
      async () => {
        runs += 1;
        await held;
        value = 7;
        return 7;
      },
      async () => value,
    );
    await Promise.resolve();
    const waiter = withCountSingleFlight(
      "k",
      async () => {
        runs += 1;
        return 9;
      },
      async () => value,
    );
    release();
    const [a, b] = await Promise.all([leader, waiter]);
    expect(a).toBe(7);
    expect(b).toBe(7);
    expect(runs).toBe(1);
  });

  it("releases a lock so a later caller can lead", async () => {
    expect(await tryAcquireCountLock("x")).toBe(true);
    expect(await tryAcquireCountLock("x")).toBe(false);
    await releaseCountLock("x");
    expect(await tryAcquireCountLock("x")).toBe(true);
  });
});
