import { describe, expect, it } from "vitest";
import {
  dealMatchesImportLead,
  guessImportMapping,
  inboundPayloadToInput,
  IMPORT_FALLBACK_COMPANY,
  mapImportLead,
} from "./import";

describe("import mapping", () => {
  it("guesses Portuguese and English headers once", () => {
    expect(
      guessImportMapping(["Empresa", "Nome", "Telefone", "E-mail", "CNPJ", "Obs"]),
    ).toEqual(["company", "name", "phone", "email", "cnpj", "notes"]);
  });

  it("keeps more than one notes column", () => {
    expect(
      guessImportMapping(["Empresa", "Anotações", "Histórico", "Nome"]),
    ).toEqual(["company", "notes", "notes", "name"]);
  });

  it("maps a person without company to the contact name", () => {
    const mapped = mapImportLead({
      name: "Maria Silva",
      phone: "11981887766",
      email: "maria@exemplo.com",
    });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.lead.company_name).toBe("Maria Silva");
    expect(mapped.lead.contact_name).toBe("Maria Silva");
    expect(mapped.lead.people[0]?.email).toBe("maria@exemplo.com");
    expect(mapped.lead.cnpj).toBeUndefined();
  });

  it("falls back to Lead inbound when only notes arrive", () => {
    const mapped = mapImportLead({ notes: "Veio do anúncio" });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.lead.company_name).toBe(IMPORT_FALLBACK_COMPANY);
  });

  it("rejects an empty row", () => {
    expect(mapImportLead({})).toEqual({ ok: false, message: "Linha vazia" });
  });

  it("joins notes aliases from a flat payload", () => {
    const input = inboundPayloadToInput({
      company: "Padaria",
      notes: "Lead Ads",
      observacao: "Pediu retorno",
    });
    expect(input.notes).toBe("Lead Ads · Pediu retorno");
  });

  it("reads Make aliases from a flat payload", () => {
    const input = inboundPayloadToInput({
      razao_social: "Padaria do João",
      full_name: "Maria Silva",
      telefone: "11981887766",
      email: "maria@exemplo.com",
      cnpj: "00.000.000/0001-91",
    });
    const mapped = mapImportLead(input);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.lead.company_name).toBe("Padaria do João");
    expect(mapped.lead.cnpj).toBe("00000000000191");
    expect(mapped.lead.contact_name).toBe("Maria Silva");
  });

  it("matches an existing deal by email or phone", () => {
    const mapped = mapImportLead({
      name: "Maria",
      email: "maria@exemplo.com",
      phone: "(11) 98188-7766",
    });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(
      dealMatchesImportLead(
        {
          cnpj: null,
          phones: [],
          people: [{ name: "Outra", phone: "", email: "MARIA@exemplo.com" }],
        },
        mapped.lead,
      ),
    ).toBe(true);
    expect(
      dealMatchesImportLead(
        {
          cnpj: null,
          phones: ["11981887766"],
          people: [{ name: "", phone: "", email: "" }],
        },
        mapped.lead,
      ),
    ).toBe(true);
  });
});
