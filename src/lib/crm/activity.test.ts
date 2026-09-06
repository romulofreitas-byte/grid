import { describe, expect, it } from "vitest";
import {
  activitySignal,
  CRM_NEXT_ACTION_LABELS,
  earliestOpenActivity,
  formatDueLabel,
  formatNextAction,
  formatPlannedActivity,
  openActivitiesOf,
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
    expect(formatNextAction(null, "Sem próxima ação")).toBe(
      "Sem próxima ação",
    );
  });

  it("formats a dated note as the card volta", () => {
    const now = new Date("2026-09-02T15:00:00-03:00");
    const activity = {
      ...open(now),
      kind: "nota" as const,
      due_at: new Date("2026-09-02T17:00:00-03:00").toISOString(),
    };
    expect(formatNextAction(activity, "Sem próxima ação")).toMatch(/Nota · /);
    expect(activitySignal(activity, now)).toBe("today");
  });

  it("formats an open volta for the history feed", () => {
    const now = new Date("2026-09-06T12:00:00-03:00");
    const activity = {
      ...open(new Date("2026-09-03T17:00:00-03:00")),
      kind: "email" as const,
    };
    expect(formatPlannedActivity(activity, now)).toMatch(/E-mail · 3\/set/i);
    expect(
      formatPlannedActivity(activity, new Date("2026-09-03T12:00:00-03:00")),
    ).toMatch(/Hoje 17:00/);
    expect(formatPlannedActivity({ ...activity, status: "done" }, now)).toBeNull();
    expect(CRM_NEXT_ACTION_LABELS.ligar).toMatch(/ligação/i);
    expect(CRM_NEXT_ACTION_LABELS.followup).toMatch(/follow-up/i);
  });
});

describe("earliestOpenActivity", () => {
  it("picks the earliest due open activity, not the newest created", () => {
    const overdue = {
      ...open(new Date("2026-08-01T15:00:00.000Z")),
      id: "ligar",
      kind: "ligar" as const,
      created_at: "2026-09-01T12:00:00.000Z",
    };
    const later = {
      ...open(new Date("2026-09-20T15:00:00.000Z")),
      id: "reuniao",
      kind: "reuniao" as const,
      created_at: "2026-09-06T12:00:00.000Z",
    };
    expect(earliestOpenActivity([later, overdue])?.id).toBe("ligar");
    expect(openActivitiesOf({ open_activities: [later, overdue] }).map((row) => row.id)).toEqual([
      "ligar",
      "reuniao",
    ]);
    expect(openActivitiesOf({ open_activities: [] })).toEqual([]);
  });

  it("labels overdue and same-day dues in relative Portuguese", () => {
    const now = new Date("2026-09-06T12:00:00-03:00");
    expect(formatDueLabel("2026-09-03T15:00:00-03:00", now)).toMatch(/3\/set 15:00/);
    expect(formatDueLabel("2026-09-06T13:00:00-03:00", now)).toMatch(/Hoje 13:00/);
  });
});
