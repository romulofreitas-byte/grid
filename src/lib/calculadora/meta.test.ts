import { describe, expect, it } from "vitest";
import { dailyGoalFromMeta, sanitizeMetaCreate, sanitizeMetaUpdate, sortMetasForList } from "./meta";

const ready = {
  nome: "Clínicas SP",
  tipo_empresa: "Clínicas",
  metaFaturamento: 80_000,
  ticket: 15_000,
  prazoMeses: 3,
  taxa1: 20,
  taxa2: 70,
  taxa3: 80,
  taxa4: 50,
  taxasOrigem: "padrao" as const,
};

describe("sanitizeMetaCreate", () => {
  it("requires a name and clips tipo", () => {
    expect(sanitizeMetaCreate({ ...ready, nome: "  " }).ok).toBe(false);
    const parsed = sanitizeMetaCreate({
      ...ready,
      tipo_empresa: "x".repeat(90),
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.nome).toBe("Clínicas SP");
      expect(parsed.value.tipo_empresa).toHaveLength(80);
    }
  });
});

describe("sanitizeMetaUpdate", () => {
  it("keeps unnamed patches from wiping the title", () => {
    expect(sanitizeMetaUpdate({ nome: "   " })).toEqual({});
    expect(sanitizeMetaUpdate({ tipoEmpresa: "Indústria" })).toEqual({
      tipo_empresa: "Indústria",
    });
  });
});

describe("dailyGoalFromMeta", () => {
  it("returns the reverse-funnel daily goal when the plan is ready", () => {
    expect(
      dailyGoalFromMeta(ready, new Date("2026-09-03T12:00:00.000Z")),
    ).toBe(9);
    expect(dailyGoalFromMeta({ ...ready, prazoMeses: 0 })).toBeNull();
  });
});

describe("sortMetasForList", () => {
  it("puts the Box meta first, then the rest by recency", () => {
    const older = {
      ...ready,
      id: "older",
      user_id: "u",
      created_by: "u",
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    };
    const newer = {
      ...ready,
      id: "newer",
      user_id: "u",
      created_by: "u",
      created_at: "2026-09-02T00:00:00.000Z",
      updated_at: "2026-09-02T00:00:00.000Z",
    };
    expect(sortMetasForList([older, newer], null).map((row) => row.id)).toEqual([
      "newer",
      "older",
    ]);
    expect(sortMetasForList([older, newer], "older").map((row) => row.id)).toEqual([
      "older",
      "newer",
    ]);
  });
});
