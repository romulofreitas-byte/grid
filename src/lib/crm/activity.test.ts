import { describe, expect, it } from "vitest";
import { activitySignal, formatNextAction } from "./activity";
import type { CrmActivity } from "./types";

function open(due: Date): CrmActivity {
  return {
    id: "a",
    deal_id: "d",
    kind: "ligar",
    due_at: due.toISOString(),
    status: "open",
    created_at: due.toISOString(),
  };
}

describe("activitySignal", () => {
  const now = new Date("2026-08-20T15:00:00-03:00");

  it("marks missing or done activity as none", () => {
    expect(activitySignal(null, now)).toBe("none");
    expect(
      activitySignal({ ...open(now), status: "done" }, now),
    ).toBe("none");
  });

  it("marks a due in the past as overdue", () => {
    expect(activitySignal(open(new Date("2026-08-19T12:00:00-03:00")), now)).toBe(
      "overdue",
    );
  });

  it("marks a later slot today as today", () => {
    expect(activitySignal(open(new Date("2026-08-20T18:00:00-03:00")), now)).toBe(
      "today",
    );
  });

  it("marks a future day as scheduled", () => {
    expect(activitySignal(open(new Date("2026-08-22T10:00:00-03:00")), now)).toBe(
      "scheduled",
    );
  });
});

describe("formatNextAction", () => {
  it("uses the empty label when there is no open volta", () => {
    expect(formatNextAction(null, "Sem volta marcada")).toBe(
      "Sem volta marcada",
    );
  });
});
