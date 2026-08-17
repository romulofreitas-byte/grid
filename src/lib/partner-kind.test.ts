import { describe, expect, it } from "vitest";
import { classifyPartner, isPessoaFisica } from "./partner-kind";

describe("classifyPartner", () => {
  it("keeps a natural-person name as pessoa", () => {
    expect(classifyPartner("Ana Paula Souza", 5)).toEqual({
      kind: "pessoa",
      label: null,
    });
    expect(isPessoaFisica("Ana Paula Souza", 5)).toBe(true);
  });

  it("labels holding by name even with an age band", () => {
    expect(classifyPartner("ALPHA HOLDING PARTICIPACOES LTDA", 5)).toEqual({
      kind: "holding",
      label: "Holding",
    });
    expect(classifyPartner("BETA INVESTIMENTOS S.A.", null)).toEqual({
      kind: "holding",
      label: "Holding",
    });
  });

  it("labels gestão / administradora / asset", () => {
    expect(classifyPartner("GAMA GESTAO EMPRESARIAL LTDA", 0)).toEqual({
      kind: "gestao",
      label: "Empresa de gestão",
    });
    expect(classifyPartner("DELTA ADMINISTRADORA DE BENS LTDA", null)).toEqual({
      kind: "gestao",
      label: "Empresa de gestão",
    });
    expect(classifyPartner("OMEGA ASSET FAMILY OFFICE", null)).toEqual({
      kind: "gestao",
      label: "Empresa de gestão",
    });
  });

  it("labels a generic PJ suffix as empresa sócia", () => {
    expect(classifyPartner("COMERCIO SILVA LTDA", 4)).toEqual({
      kind: "empresa",
      label: "Empresa sócia",
    });
    expect(classifyPartner("INDUSTRIA NORTE S/A", null)).toEqual({
      kind: "empresa",
      label: "Empresa sócia",
    });
    expect(classifyPartner("OFICINA CENTRAL ME", null)).toEqual({
      kind: "empresa",
      label: "Empresa sócia",
    });
  });

  it("treats faixa_etaria 0 as PJ even without a suffix", () => {
    expect(classifyPartner("JOAO SILVA PARTICIPACOES", 0).kind).toBe("holding");
    expect(classifyPartner("JOAO SILVA", 0)).toEqual({
      kind: "empresa",
      label: "Empresa sócia",
    });
    expect(isPessoaFisica("JOAO SILVA", 0)).toBe(false);
  });

  it("does not treat Medeiros as the ME suffix", () => {
    expect(classifyPartner("Jose Medeiros", 6)).toEqual({
      kind: "pessoa",
      label: null,
    });
  });
});
