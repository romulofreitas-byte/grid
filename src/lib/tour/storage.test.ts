import { describe, expect, it } from "vitest";
import {
  clearTourCompleted,
  clearTourSession,
  isTourCompleted,
  persistTourCompleted,
  readTourSession,
  tourDoneKey,
  writeTourSession,
} from "./storage";

function memory(): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
} {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe("tour storage", () => {
  it("round-trips a session and ignores junk", () => {
    const store = memory();
    writeTourSession({ origin: "app", index: 4 }, store);
    expect(readTourSession(store)).toEqual({ origin: "app", index: 4 });
    store.setItem("grid_tour_session", "{nope");
    expect(readTourSession(store)).toBeNull();
    clearTourSession(store);
    expect(readTourSession(store)).toBeNull();
  });

  it("keys completion per user and only persists for the app or a signed-in visitor", () => {
    const store = memory();
    expect(tourDoneKey("u1")).toBe("grid_tour_completed:u1");
    persistTourCompleted("landing", false, null, store);
    expect(isTourCompleted(null, store)).toBe(false);
    persistTourCompleted("landing", true, "u1", store);
    expect(isTourCompleted("u1", store)).toBe(true);
    expect(isTourCompleted(null, store)).toBe(false);
    clearTourCompleted("u1", store);
    expect(isTourCompleted("u1", store)).toBe(false);
    persistTourCompleted("app", false, null, store);
    expect(isTourCompleted(null, store)).toBe(true);
  });
});
