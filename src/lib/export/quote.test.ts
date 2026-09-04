import { describe, expect, it } from "vitest";
import { parseExportQuote } from "./quote";
import { exportLimitForFormat } from "./qualified";

describe("parseExportQuote", () => {
  it("accepts a complete quote payload", () => {
    expect(
      parseExportQuote({
        companies: 12,
        chargeable: 10,
        skipped: 2,
        unitCost: 50,
        needed: 500,
        available: 900,
      }),
    ).toEqual({
      companies: 12,
      chargeable: 10,
      skipped: 2,
      unitCost: 50,
      needed: 500,
      available: 900,
    });
  });

  it("rejects incomplete payloads", () => {
    expect(parseExportQuote({ needed: 50 })).toBeNull();
    expect(parseExportQuote(null)).toBeNull();
    expect(parseExportQuote({ error: "nope" })).toBeNull();
  });
});

describe("exportLimitForFormat", () => {
  it("caps PDF at 50 and the rest at 1000", () => {
    expect(exportLimitForFormat("pdf")).toBe(50);
    expect(exportLimitForFormat("xlsx")).toBe(1000);
    expect(exportLimitForFormat("csv")).toBe(1000);
    expect(exportLimitForFormat(null)).toBe(1000);
  });
});
