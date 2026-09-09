import { describe, expect, it } from "vitest";
import {
  asCompanySearchHit,
  asCrmActivityKind,
  companyGridAction,
  uniqueCompanyCnpjs,
} from "./context";

describe("uniqueCompanyCnpjs", () => {
  it("pads, dedupes and drops junk", () => {
    expect(
      uniqueCompanyCnpjs([
        "12.345.678/0001-90",
        "12345678000190",
        "abc",
        "00000000000191",
      ]),
    ).toEqual(["12345678000190", "00000000000191"]);
    expect(uniqueCompanyCnpjs([""])).toEqual([]);
  });
});

describe("companyGridAction", () => {
  it("opens CRM when a deal exists", () => {
    expect(
      companyGridAction({
        cnpj: "12345678000190",
        called: false,
        qualified: false,
        list: {
          searchId: "s1",
          nome: "Clínicas",
          saved: true,
        },
        crm: {
          dealId: "d1",
          pipelineId: "p1",
          pipelineNome: "Clínicas",
          stageNome: "Entrada",
          nextKind: null,
          nextDueAt: null,
        },
      }),
    ).toEqual({
      type: "open_crm",
      href: "/crm?pipeline=p1&deal=d1",
    });
  });

  it("opens the list when the company is only on a list", () => {
    expect(
      companyGridAction({
        cnpj: "12345678000190",
        called: true,
        crm: null,
        list: { searchId: "s1", nome: "Clínicas", saved: true },
      }),
    ).toEqual({
      type: "open_list",
      href: "/grid/s1?from=empresas",
    });
  });

  it("enters CRM when the company is outside the Grid", () => {
    expect(companyGridAction(undefined)).toEqual({ type: "enter_crm" });
    expect(
      companyGridAction({
        cnpj: "12345678000190",
        called: false,
        crm: null,
        list: null,
      }),
    ).toEqual({ type: "enter_crm" });
  });
});

describe("asCrmActivityKind", () => {
  it("accepts known kinds", () => {
    expect(asCrmActivityKind("ligar")).toBe("ligar");
    expect(asCrmActivityKind("nope")).toBeNull();
  });
});

describe("asCompanySearchHit", () => {
  it("fills missing Receita fields", () => {
    expect(
      asCompanySearchHit({
        cnpj: "12345678000190",
        razaoSocial: "ACME",
        nomeFantasia: null,
        municipio: "BH",
        uf: "MG",
      }),
    ).toMatchObject({
      cnaeCodigo: null,
      cnaeDescricao: "",
      telefone: null,
    });
  });
});
