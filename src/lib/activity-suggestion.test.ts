import { describe, expect, it } from "vitest";
import { matchActivitySuggestion } from "./activity-suggestion";

describe("matchActivitySuggestion", () => {
  it("maps commercial activity terms to the curated niche", () => {
    expect(matchActivitySuggestion("madeireira")?.slug).toBe(
      "madeira-compensados",
    );
    expect(matchActivitySuggestion("Madeira")?.slug).toBe("madeira-compensados");
    expect(matchActivitySuggestion("mineração")?.slug).toBe(
      "mineracao-beneficiamento",
    );
    expect(matchActivitySuggestion("mineradora")?.nome).toMatch(/mineração/i);
    expect(matchActivitySuggestion("spa")?.slug).toBe("spa-bem-estar");
  });

  it("does not treat a company name or CNPJ as an activity", () => {
    expect(matchActivitySuggestion("Vale S.A.")).toBeNull();
    expect(matchActivitySuggestion("33.592.510/0001-54")).toBeNull();
    expect(matchActivitySuggestion("ab")).toBeNull();
    expect(matchActivitySuggestion("Ana")).toBeNull();
  });

  it("prefers a segment over its parent niche on a tie", () => {
    const hit = matchActivitySuggestion("clínica médica");
    expect(hit?.slug).toBe("clinicas-medicas");
  });
});
