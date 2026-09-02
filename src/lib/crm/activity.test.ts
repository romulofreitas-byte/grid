import { describe, expect, it } from "vitest";
import {
  activitySignal,
  CRM_NEXT_ACTION_LABELS,
  formatNextAction,
  formatPlannedActivity,
} from "./activity";
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

  it("formats a dated note as the card volta", () => {
    const now = new Date("2026-09-02T15:00:00-03:00");
    const activity = {
      ...open(now),
      kind: "nota" as const,
      due_at: new Date("2026-09-02T17:00:00-03:00").toISOString(),
    };
    expect(formatNextAction(activity, "Sem volta marcada")).toMatch(/Nota · /);
    expect(activitySignal(activity, now)).toBe("today");
  });

  it("formats an open volta for the history feed", () => {
    const activity = {
      ...open(new Date("2026-09-03T17:00:00-03:00")),
      kind: "email" as const,
    };
    expect(formatPlannedActivity(activity)).toMatch(/E-mail · 3\/set/i);
    expect(formatPlannedActivity({ ...activity, status: "done" })).toBeNull();
    expect(CRM_NEXT_ACTION_LABELS.ligar).toMatch(/ligação/i);
    expect(CRM_NEXT_ACTION_LABELS.followup).toMatch(/follow-up/i);
  });
});
