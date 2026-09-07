import { describe, expect, it } from "vitest";
import {
  discoveryAliases,
  extraDiscoveryAliases,
  hostLabelMatchesBrand,
} from "./brand-aliases";

const vaz = {
  nomeFantasia: "Metalúrgica Vaz",
  razaoSocial: "VAZ E VAZ METALURGIA LTDA",
};

describe("discoveryAliases", () => {
  it("keeps fantasia and stripped razão plus compounds in both orders", () => {
    const aliases = discoveryAliases(vaz);
    expect(aliases[0]).toBe("Metalúrgica Vaz");
    expect(aliases).toContain("VAZ E VAZ METALURGIA");
    expect(aliases.some((alias) => /^vaz metalurg/i.test(alias))).toBe(true);
  });

  it("includes extra CRM / Maps names", () => {
    expect(
      discoveryAliases({
        ...vaz,
        extraNames: ["Metalurgica Vaz Contagem"],
      }),
    ).toContain("Metalurgica Vaz Contagem");
  });

  it("turns IDOS@ into IDOSO for search", () => {
    expect(
      discoveryAliases({
        nomeFantasia: "LIVE IN A CASA DE IDOS@ FELIZ",
        razaoSocial: "LIVE IN A CASA DE IDOS@ FELIZ LTDA",
      }),
    ).toContain("LIVE IN A CASA DE IDOSO FELIZ");
  });
});

describe("extraDiscoveryAliases", () => {
  it("drops names already used as the primary search", () => {
    const extra = extraDiscoveryAliases(vaz, 2);
    expect(extra).not.toContain("Metalúrgica Vaz");
    expect(extra.length).toBeLessThanOrEqual(2);
  });
});

describe("hostLabelMatchesBrand", () => {
  it("matches a concatenated weak+trade host", () => {
    expect(
      hostLabelMatchesBrand(
        "metalurgicavaz",
        vaz.razaoSocial,
        vaz.nomeFantasia,
        "Contagem",
      ),
    ).toBeGreaterThan(0);
    expect(
      hostLabelMatchesBrand(
        "vazmetalurgia",
        vaz.razaoSocial,
        vaz.nomeFantasia,
        "Contagem",
      ),
    ).toBeGreaterThan(0);
  });

  it("does not match an unrelated host", () => {
    expect(
      hostLabelMatchesBrand(
        "padariadocentro",
        vaz.razaoSocial,
        vaz.nomeFantasia,
        "Contagem",
      ),
    ).toBe(0);
  });
});
