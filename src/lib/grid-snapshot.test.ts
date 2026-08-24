import { describe, expect, it } from "vitest";
import {
  gridRowFromSnapshot,
  gridRowStub,
  parseGridSnapshot,
} from "./grid-snapshot";
import type { GridRowSnapshot } from "./types";

const snap: GridRowSnapshot = {
  razaoSocial: "METALURGICA XYZ LTDA",
  nomeFantasia: "XYZ",
  municipio: "Belo Horizonte",
  uf: "MG",
  cnaeCodigo: "2511000",
  cnaeDescricao: "Fabricação de estruturas metálicas",
  telefone: "3133334444",
  seal: "NAO_CONFIRMADO",
  sharedCount: 1,
  sharedVerdict: "proprio",
  decisorNome: "Maria Silva",
  porte: "03",
  email: "contato@xyz.com.br",
};

describe("parseGridSnapshot", () => {
  it("reads an object wrapped in gridSnapshot", () => {
    expect(parseGridSnapshot({ gridSnapshot: snap })).toMatchObject({
      razaoSocial: "METALURGICA XYZ LTDA",
      uf: "MG",
    });
  });

  it("reads a JSON string (legacy / double-encoded)", () => {
    expect(
      parseGridSnapshot(JSON.stringify({ gridSnapshot: snap })),
    ).toMatchObject({
      razaoSocial: "METALURGICA XYZ LTDA",
      uf: "MG",
      telefone: "3133334444",
    });
  });

  it("reads a bare snapshot object", () => {
    expect(parseGridSnapshot(snap)?.razaoSocial).toBe("METALURGICA XYZ LTDA");
  });

  it("returns null for invalid payloads", () => {
    expect(parseGridSnapshot(null)).toBeNull();
    expect(parseGridSnapshot("not-json")).toBeNull();
    expect(parseGridSnapshot({})).toBeNull();
    expect(parseGridSnapshot({ gridSnapshot: { uf: "MG" } })).toBeNull();
  });
});

describe("gridRowFromSnapshot / stub", () => {
  it("keeps Receita snapshot fields on the grid row", () => {
    const row = gridRowFromSnapshot("12345678000195", snap, {
      gridScore: 80,
      gridPosition: 1,
    });
    expect(row.razaoSocial).toBe("METALURGICA XYZ LTDA");
    expect(row.cnpj).toBe("12345678000195");
    expect(row.gridPosition).toBe(1);
    expect(row.hasAudit).toBe(false);
  });

  it("stub never invents a company name — only the CNPJ", () => {
    const row = gridRowStub("12345678000195", {
      gridScore: 10,
      gridPosition: 2,
    });
    expect(row.razaoSocial).toBe("12345678000195");
    expect(row.uf).toBe("");
    expect(row.telefone).toBeNull();
  });
});
