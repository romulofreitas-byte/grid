import { describe, expect, it } from "vitest";
import { pickUniqueCompanyHit } from "./import-match";
import type { CompanySearchHit } from "@/lib/types";

function hit(partial: Partial<CompanySearchHit> & { razaoSocial: string }): CompanySearchHit {
  return {
    cnpj: partial.cnpj ?? "00000000000191",
    razaoSocial: partial.razaoSocial,
    nomeFantasia: partial.nomeFantasia ?? null,
    municipio: "",
    uf: "",
    cnaeCodigo: null,
    cnaeDescricao: "",
    telefone: null,
  };
}

describe("pickUniqueCompanyHit", () => {
  it("takes a single aligned hit", () => {
    const picked = pickUniqueCompanyHit("Roal Indústria Metalúrgica Ltda", [
      hit({ razaoSocial: "ROAL INDUSTRIA METALURGICA LTDA" }),
    ]);
    expect(picked?.razaoSocial).toMatch(/ROAL/i);
  });

  it("does not guess when two companies share the name", () => {
    expect(
      pickUniqueCompanyHit("Padaria do João", [
        hit({ cnpj: "1".padStart(14, "0"), razaoSocial: "Padaria do João Ltda" }),
        hit({ cnpj: "2".padStart(14, "0"), razaoSocial: "Padaria do João ME" }),
      ]),
    ).toBeNull();
  });
});
