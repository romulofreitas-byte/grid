import { describe, expect, it } from "vitest";
import {
  dispositionToLeadStatus,
  normalizeDisposition,
  parseInboundOutcome,
} from "./outcomes";

describe("dispositionToLeadStatus", () => {
  it("maps Portuguese and English aliases", () => {
    expect(dispositionToLeadStatus("Reunião")).toBe("reuniao");
    expect(dispositionToLeadStatus("agendou")).toBe("reuniao");
    expect(dispositionToLeadStatus("not interested")).toBe("descartado");
    expect(dispositionToLeadStatus("não atendeu")).toBe("ligando");
    expect(dispositionToLeadStatus("NOVO")).toBe("novo");
  });

  it("returns null for unknown tabulation", () => {
    expect(dispositionToLeadStatus("fez-cafe")).toBeNull();
  });

  it("normalizes accents and separators", () => {
    expect(normalizeDisposition("Não-Perturbe")).toBe("nao_perturbe");
    expect(dispositionToLeadStatus("Não-Perturbe")).toBe("descartado");
  });
});

describe("parseInboundOutcome", () => {
  it("accepts cnpj + disposition", () => {
    const parsed = parseInboundOutcome({
      cnpj: "12345678000190",
      disposition: "meeting",
      duration_sec: 42,
    });
    expect(parsed.status).toBe("reuniao");
    expect(parsed.body.cnpj).toBe("12345678000190");
  });

  it("requires cnpj or e164", () => {
    expect(() =>
      parseInboundOutcome({ disposition: "reuniao" }),
    ).toThrow();
  });
});
