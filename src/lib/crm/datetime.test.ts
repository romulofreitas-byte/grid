import { describe, expect, it } from "vitest";
import {
  formatDatetimeLocal,
  monthCells,
  parseDatetimeLocal,
  parseTimeInput,
  maskTimeDigits,
  completeTimeDigits,
  shiftMonth,
} from "./datetime";

describe("datetime local", () => {
  it("round-trips a local stamp", () => {
    const parts = parseDatetimeLocal("2026-08-21T10:00");
    expect(parts).toEqual({
      year: 2026,
      month: 7,
      day: 21,
      hours: 10,
      minutes: 0,
    });
    expect(formatDatetimeLocal(parts!)).toBe("2026-08-21T10:00");
  });

  it("builds a Monday-first August 2026 grid", () => {
    const cells = monthCells(2026, 7);
    expect(cells[0]).toEqual({
      day: 27,
      inMonth: false,
      key: "2026-07-27",
    });
    expect(cells.find((cell) => cell.key === "2026-08-01")).toEqual({
      day: 1,
      inMonth: true,
      key: "2026-08-01",
    });
    expect(cells).toHaveLength(42);
  });

  it("shifts month across the year", () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });

  it("parses keyboard time stamps", () => {
    expect(parseTimeInput("14:00")).toEqual({ hours: 14, minutes: 0 });
    expect(parseTimeInput("9:30")).toEqual({ hours: 9, minutes: 30 });
    expect(parseTimeInput("0930")).toEqual({ hours: 9, minutes: 30 });
    expect(parseTimeInput("1400")).toEqual({ hours: 14, minutes: 0 });
    expect(parseTimeInput("7")).toEqual({ hours: 7, minutes: 0 });
    expect(parseTimeInput("25:00")).toBeNull();
  });

  it("masks four keystrokes into hour and minute", () => {
    expect(maskTimeDigits("1")).toBe("1");
    expect(maskTimeDigits("14")).toBe("14");
    expect(maskTimeDigits("143")).toBe("14:3");
    expect(maskTimeDigits("1430")).toBe("14:30");
    expect(completeTimeDigits("14")).toBe("1400");
    expect(completeTimeDigits("9")).toBe("0900");
    expect(completeTimeDigits("930")).toBe("0930");
    expect(completeTimeDigits("143")).toBe("1430");
    expect(parseTimeInput(maskTimeDigits("0900"))).toEqual({
      hours: 9,
      minutes: 0,
    });
  });
});
