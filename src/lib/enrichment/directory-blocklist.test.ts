import { describe, expect, it } from "vitest";
import { isDirectoryUrl } from "./directory-blocklist";

describe("isDirectoryUrl", () => {
  it("blocks school portals and CNPJ aggregators", () => {
    expect(isDirectoryUrl("https://escolasbrasil.org/minas-gerais/bh")).toBe(
      true,
    );
    expect(isDirectoryUrl("https://www.escolas.com.br/colegio-x")).toBe(true);
    expect(isDirectoryUrl("https://cnpjcheck.com.br/empresa/foo")).toBe(true);
    expect(isDirectoryUrl("https://qedu.org.br/escola/1")).toBe(true);
  });

  it("does not treat a branded school host as a directory", () => {
    expect(isDirectoryUrl("https://santadoroteiabh.com.br/")).toBe(false);
    expect(isDirectoryUrl("https://colegiogenesis.com.br")).toBe(false);
  });

  it("matches dotted hosts as suffixes, not loose substrings", () => {
    expect(isDirectoryUrl("https://notasx.com.br")).toBe(false);
    expect(isDirectoryUrl("https://x.com/escola")).toBe(true);
    expect(isDirectoryUrl("https://maps.google.com/?cid=1")).toBe(true);
  });
});
