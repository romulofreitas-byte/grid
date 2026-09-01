import { describe, expect, it } from "vitest";
import {
  isGridRowQualified,
  isGridRowQualifying,
} from "./grid-qualify";

describe("grid qualify badge", () => {
  it("does not show Qualificado while billed and the job is still running", () => {
    const row = {
      cnpj: "12345678000190",
      hasAudit: true,
      enrichmentStatus: "running" as const,
    };
    const qualifying = isGridRowQualifying(row, new Set());
    expect(qualifying).toBe(true);
    expect(isGridRowQualified(row, qualifying)).toBe(false);
  });

  it("treats billed-without-job as still cruzando until a complete audit exists", () => {
    const row = {
      cnpj: "12345678000190",
      hasAudit: true,
      enrichmentStatus: null,
    };
    const qualifying = isGridRowQualifying(row, new Set());
    expect(qualifying).toBe(true);
    expect(isGridRowQualified(row, qualifying)).toBe(false);
  });

  it("shows Qualificado only after the job finishes", () => {
    const row = {
      cnpj: "12345678000190",
      hasAudit: true,
      enrichmentStatus: "done" as const,
    };
    const qualifying = isGridRowQualifying(row, new Set());
    expect(qualifying).toBe(false);
    expect(isGridRowQualified(row, qualifying)).toBe(true);
  });
});
