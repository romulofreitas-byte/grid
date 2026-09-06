import { describe, expect, it } from "vitest";
import { buildBoxRhythm, emptyBoxRhythm, rhythmNeedsPulse } from "./rhythm";

const now = new Date("2026-09-05T18:00:00-03:00");

describe("buildBoxRhythm", () => {
  it("counts today's calls against the goal and fills 14 habit days", () => {
    const rhythm = buildBoxRhythm({
      now,
      callGoal: 14,
      callCreatedAt: [
        "2026-09-05T10:00:00-03:00",
        "2026-09-05T11:00:00-03:00",
        "2026-09-04T09:00:00-03:00",
      ],
      crmEvents: [],
    });
    expect(rhythm.callsToday).toBe(2);
    expect(rhythm.callGoal).toBe(14);
    expect(rhythm.habit).toHaveLength(14);
    expect(rhythm.habit[rhythm.habit.length - 1]).toEqual({
      day: "2026-09-05",
      calls: 2,
      meta: 14,
    });
    expect(rhythm.habit[rhythm.habit.length - 2]?.calls).toBe(1);
  });

  it("counts CRM ligar, WhatsApp and reunião on the São Paulo day only", () => {
    const rhythm = buildBoxRhythm({
      now,
      callGoal: 10,
      callCreatedAt: [],
      crmEvents: [
        { kind: "ligar", created_at: "2026-09-05T08:00:00-03:00" },
        { kind: "ligar", created_at: "2026-09-04T22:00:00-03:00" },
        { kind: "whatsapp", created_at: "2026-09-05T12:00:00-03:00" },
        { kind: "reuniao", created_at: "2026-09-05T16:00:00-03:00" },
        { kind: "email", created_at: "2026-09-05T16:00:00-03:00" },
      ],
    });
    expect(rhythm.crmCallsToday).toBe(1);
    expect(rhythm.crmWhatsappToday).toBe(1);
    expect(rhythm.crmMeetingsToday).toBe(1);
  });

  it("returns zeros from emptyBoxRhythm", () => {
    expect(emptyBoxRhythm(20).callsToday).toBe(0);
    expect(emptyBoxRhythm(20).callGoal).toBe(20);
  });
});

describe("rhythmNeedsPulse", () => {
  it("pulses when overdue work is waiting", () => {
    expect(rhythmNeedsPulse(emptyBoxRhythm(14), 1)).toBe(true);
  });

  it("pulses when today's calls are below the goal", () => {
    expect(
      rhythmNeedsPulse({ callsToday: 1, callGoal: 14 }, 0),
    ).toBe(true);
  });

  it("stays quiet when the goal is met and nothing is overdue", () => {
    expect(
      rhythmNeedsPulse({ callsToday: 14, callGoal: 14 }, 0),
    ).toBe(false);
  });
});
