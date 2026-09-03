import { describe, expect, it } from "vitest";
import {
  extractTitularFromRazao,
  isNaturezaUnipessoal,
  titularFromRazao,
} from "./titular-from-razao";

describe("extractTitularFromRazao", () => {
  it("strips a leading CNPJ básico (P7)", () => {
    expect(extractTitularFromRazao("38.453.434 JOSE THEIMY FERNANDES MACEDO")).toBe(
      "JOSE THEIMY FERNANDES MACEDO",
    );
  });

  it("strips a trailing 11-digit CPF (P8)", () => {
    expect(extractTitularFromRazao("JOSE CESAR DE SOUZA NETO 01690595299")).toBe(
      "JOSE CESAR DE SOUZA NETO",
    );
  });

  it("strips a leading CNPJ básico (P9)", () => {
    expect(extractTitularFromRazao("41.931.380 WALLASON MOREIRA BENEVIDES")).toBe(
      "WALLASON MOREIRA BENEVIDES",
    );
  });

  it("strips a trailing CPF from a long name with particles (P11)", () => {
    expect(
      extractTitularFromRazao("HANNA FABIELLY DOS SANTOS HOLANDA 02248911203"),
    ).toBe("HANNA FABIELLY DOS SANTOS HOLANDA");
  });

  it("does not invent a titular from a trade name without a document (P6, P10, P12)", () => {
    expect(extractTitularFromRazao("TOINHO GUINCHO")).toBeNull();
    expect(extractTitularFromRazao("CONSTRUTORA DEUS E FIEL")).toBeNull();
    expect(extractTitularFromRazao("MUNCK TUBARAO SOLUCOES")).toBeNull();
  });

  it("accepts formatted CPF and CNPJ", () => {
    expect(extractTitularFromRazao("MARIA SILVA 000.000.000-00")).toBe("MARIA SILVA");
    expect(extractTitularFromRazao("00.000.000/0001-00 MARIA SILVA")).toBe(
      "MARIA SILVA",
    );
  });

  it("never returns leftover digits", () => {
    const nome = extractTitularFromRazao(
      "HANNA FABIELLY DOS SANTOS HOLANDA 02248911203",
    );
    expect(nome).toBeTruthy();
    expect(nome).not.toMatch(/\d/);
  });

  it("rejects a leftover corporate suffix after stripping", () => {
    expect(extractTitularFromRazao("ALPHA COMERCIO LTDA 12345678901")).toBeNull();
  });
});

describe("isNaturezaUnipessoal", () => {
  it("accepts EI, EIRELI, SLU-capable LTDA and related codes", () => {
    for (const id of [2135, 2305, 2313, 2321, 2348, 4014, 4120, 2062]) {
      expect(isNaturezaUnipessoal(id)).toBe(true);
    }
  });

  it("rejects SA and missing natureza", () => {
    expect(isNaturezaUnipessoal(2054)).toBe(false);
    expect(isNaturezaUnipessoal(null)).toBe(false);
  });
});

describe("titularFromRazao", () => {
  it("extracts for EI when the razão has a document", () => {
    expect(
      titularFromRazao("JOSE CESAR DE SOUZA NETO 01690595299", 2135),
    ).toBe("JOSE CESAR DE SOUZA NETO");
  });

  it("extracts for 2062 only when the document pattern is present", () => {
    expect(
      titularFromRazao("38.453.434 JOSE THEIMY FERNANDES MACEDO", 2062),
    ).toBe("JOSE THEIMY FERNANDES MACEDO");
    expect(titularFromRazao("CONSTRUTORA DEUS E FIEL", 2062)).toBeNull();
  });

  it("does not extract for a non-unipessoal natureza even with a document", () => {
    expect(
      titularFromRazao("JOSE CESAR DE SOUZA NETO 01690595299", 2054),
    ).toBeNull();
  });
});
