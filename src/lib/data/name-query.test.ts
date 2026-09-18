import { describe, expect, it } from "vitest";
import {
  canUseNameQuery,
  emptyNamePreview,
  establishmentNameMatches,
  isUmbrellaSegment,
  nameContainsGroupsSql,
  nameContainsSql,
  nameIlikeAndSql,
  nameIlikeGroupsSql,
  nameIlikeNeedles,
  nameQueryNeedles,
  nameStemNeedles,
  qualifyTradeAliases,
  qualifyTradeNeedles,
} from "./name-query";

describe("nameQueryNeedles", () => {
  it("drops short legal tokens and keeps tapiocaria", () => {
    expect(nameQueryNeedles("ta")).toEqual([]);
    expect(canUseNameQuery("tapiocaria")).toBe(true);
    expect(nameQueryNeedles("Tapiocaria LTDA")).toEqual(["tapiocaria"]);
    expect(nameQueryNeedles("ortopedia molecular")).toEqual([
      "ortopedia",
      "molecular",
    ]);
  });
});

describe("establishmentNameMatches", () => {
  it("requires every query token in fantasia or razão", () => {
    expect(
      establishmentNameMatches(
        "FOGO DE CHAO RESTAURANTES LTDA",
        "Fogo de Chão",
        "tapiocaria",
        [],
      ),
    ).toBe(false);
    expect(
      establishmentNameMatches(
        "MARIA TAPIOCARIA LTDA",
        "Tapiocaria da Maria",
        "tapiocaria",
        [],
      ),
    ).toBe(true);
  });

  it("ORs name stems for umbrella segments", () => {
    expect(
      establishmentNameMatches(
        "RESTAURANTE CENTRAL LTDA",
        "Central",
        null,
        ["CHURRAS", "GRILL"],
      ),
    ).toBe(false);
    expect(
      establishmentNameMatches(
        "CHURRASQUEIRO DO ZE LTDA",
        null,
        null,
        ["CHURRAS", "GRILL"],
      ),
    ).toBe(true);
    expect(
      establishmentNameMatches("GRILL HOUSE LTDA", "Grill", null, [
        "CHURRAS",
        "GRILL",
      ]),
    ).toBe(true);
  });

  it("ANDs query with stems when both are set", () => {
    expect(
      establishmentNameMatches(
        "CHURRASQUEIRO DO ZE LTDA",
        "Churras",
        "churrasqueiro",
        ["CHURRAS"],
      ),
    ).toBe(true);
    expect(
      establishmentNameMatches(
        "PADARIA CENTRAL LTDA",
        "Padaria",
        "churrasqueiro",
        ["CHURRAS"],
      ),
    ).toBe(false);
  });
});

describe("isUmbrellaSegment", () => {
  it("treats churrascaria as umbrella and barbearia as specific", () => {
    expect(
      isUmbrellaSegment(
        ["CHURRAS", "GRILL"],
        ["Restaurantes e similares"],
      ),
    ).toBe(true);
    expect(
      isUmbrellaSegment(
        ["BARBEARIA", "BARBEIRO"],
        ["Cabeleireiros barbearia e barbeiro"],
      ),
    ).toBe(false);
    expect(nameStemNeedles(["CHURRAS", "GRILL"])).toEqual(["churras", "grill"]);
  });
});

describe("nameIlikeNeedles", () => {
  it("keeps accents and adds the ASCII twin so Receita names still hit", () => {
    expect(nameIlikeNeedles("assador")).toEqual(["assador"]);
    expect(nameIlikeNeedles("funerária")).toEqual(["funerária", "funeraria"]);
    expect(nameIlikeNeedles("Clínica LTDA")).toEqual(["Clínica", "Clinica"]);
    expect(nameIlikeNeedles("ta")).toEqual([]);
  });
});

describe("nameContainsSql", () => {
  it("binds each needle once for fantasia or razão with raw ILIKE", () => {
    const sql = nameContainsSql("es.nome_fantasia", "es.razao_social", 3, [
      "tapiocaria",
    ], "and");
    expect(sql?.params).toEqual(["%tapiocaria%"]);
    expect(sql?.sql).toContain("$3");
    expect(sql?.sql).toMatch(/nome_fantasia ilike \$3/);
    expect(sql?.sql).toMatch(/razao_social ilike \$3/);
    expect(sql?.sql).not.toMatch(/translate/i);
  });
});

describe("nameIlikeAndSql", () => {
  it("ANDs ILIKE on one column so UNION arms reuse the same params", () => {
    expect(nameIlikeAndSql("es.nome_fantasia", 1, 2)).toBe(
      "es.nome_fantasia ilike $1 escape '\\' and es.nome_fantasia ilike $2 escape '\\'",
    );
  });
});

describe("nameIlikeGroupsSql", () => {
  it("ORs accent variants of a token on one column", () => {
    expect(
      nameIlikeGroupsSql("es.nome_fantasia", 1, [["funerária", "funeraria"]]),
    ).toBe(
      "(es.nome_fantasia ilike $1 escape '\\' or es.nome_fantasia ilike $2 escape '\\')",
    );
  });
});

describe("nameContainsGroupsSql", () => {
  it("ORs accent twins and ANDs distinct tokens", () => {
    const sql = nameContainsGroupsSql("es.nome_fantasia", "es.razao_social", 1, [
      ["funerária", "funeraria"],
    ]);
    expect(sql?.params).toEqual(["%funerária%", "%funeraria%"]);
    expect(sql?.sql).toMatch(/ilike \$1/);
    expect(sql?.sql).toMatch(/ilike \$2/);
    expect(sql?.sql).toContain(" or ");
  });
});

describe("emptyNamePreview", () => {
  it("flags timeout separately from an empty sample", () => {
    expect(emptyNamePreview(true, true)).toEqual({
      total: 0,
      sampled: true,
      timedOut: true,
      cnaes: [],
    });
  });
});

describe("qualifyTradeNeedles", () => {
  it("folds funerária and drops short stems like pet", () => {
    expect(qualifyTradeNeedles({ nameQuery: "funerária" })).toEqual([
      "funeraria",
    ]);
    expect(
      qualifyTradeNeedles({
        matchNameStems: true,
        stems: ["PET", "CREMA"],
      }),
    ).toEqual(["crema"]);
  });
});

describe("qualifyTradeAliases", () => {
  it("composes fantasia + term when only the razão has the needle", () => {
    expect(
      qualifyTradeAliases({
        fantasia: "São José",
        razao: "FUNERARIA SAO JOSE LTDA",
        needles: ["funeraria"],
      }),
    ).toEqual(["São José funeraria"]);
  });

  it("stays empty when fantasia already carries the term", () => {
    expect(
      qualifyTradeAliases({
        fantasia: "Funerária São José",
        razao: "FUNERARIA SAO JOSE LTDA",
        needles: ["funeraria"],
      }),
    ).toEqual([]);
  });

  it("stays empty without fantasia so we do not search the ramo alone", () => {
    expect(
      qualifyTradeAliases({
        fantasia: null,
        razao: "FUNERARIA SAO JOSE LTDA",
        needles: ["funeraria"],
      }),
    ).toEqual([]);
  });
});
