import { describe, expect, it } from "vitest";
import { formatRelativeShort } from "./format";

describe("formatRelativeShort", () => {
  const now = new Date("2026-09-02T15:00:00.000Z");

  it("labels today, yesterday, and recent days", () => {
    expect(formatRelativeShort("2026-09-02T08:00:00.000Z", now)).toBe("hoje");
    expect(formatRelativeShort("2026-09-01T08:00:00.000Z", now)).toBe("ontem");
    expect(formatRelativeShort("2026-08-30T08:00:00.000Z", now)).toBe(
      "há 3 dias",
    );
  });

  it("falls back to a date after a month", () => {
    expect(formatRelativeShort("2026-07-02T08:00:00.000Z", now)).toBe(
      "02/07/2026",
    );
  });

  it("returns empty on invalid input", () => {
    expect(formatRelativeShort("not-a-date", now)).toBe("");
  });
});
