import { describe, expect, it } from "vitest";
import {
  dealMatchesImportLead,
  guessImportMapping,
  hydrateImportRow,
  inboundPayloadToInput,
  importRowsForSubmit,
  IMPORT_FALLBACK_COMPANY,
  mapImportLead,
  withoutInvalidCnpj,
} from "./import";
import { IMPORT_NOTE_NAME_MESSAGE } from "./import-issues";

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

  it("maps a Maps NAME column with Ltda to company", () => {
    expect(
      guessImportMapping(
        ["NAME", "PHONE", "WEBSITE"],
        [["Roal Indústria Metalúrgica Ltda", "5432892400", "http://roal.com.br"]],
      ),
    ).toEqual(["company", "phone", "website"]);
  });

  it("keeps extra phone, sócios and notes columns", () => {
    expect(
      guessImportMapping(
        ["nome", "Telefone", "Telefone 2", "socios", "Notas", "Próxima Atividade"],
        [["Metalúrgica Vaz Ltda", "31 3434-3084", "31 99999-0000", "PAULO VAZ", "já fazem", "ligar"]],
      ),
    ).toEqual(["company", "phone", "phone", "people", "notes", "notes"]);
  });

  it("keeps a person NAME as contact", () => {
    expect(
      guessImportMapping(["NAME", "PHONE"], [["Maria Silva", "11981887766"]]),
    ).toEqual(["name", "phone"]);
  });

  it("does not copy a company-like NAME into the contact", () => {
    const mapped = mapImportLead({
      name: "Roal Indústria Metalúrgica Ltda",
      phone: "5432892400",
    });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.lead.company_name).toBe("Roal Indústria Metalúrgica Ltda");
    expect(mapped.lead.contact_name).toBe("");
    expect(mapped.lead.kind).toBe("company");
  });

  it("treats a person NAME as contact, not company", () => {
    const mapped = mapImportLead({
      name: "Maria Silva",
      phone: "11981887766",
      email: "maria@exemplo.com",
    });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.lead.company_name).toBe("Maria Silva");
    expect(mapped.lead.contact_name).toBe("Maria Silva");
    expect(mapped.lead.kind).toBe("person");
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

  it("drops empty rows before submit", () => {
    expect(
      importRowsForSubmit(
        [{}, { company: "Padaria" }, { cnpj: "123456789012345" }],
        "ready",
        1000,
      ),
    ).toEqual([{ company: "Padaria" }]);
    expect(
      importRowsForSubmit(
        [{ company: "Padaria", cnpj: "123456789012345" }],
        "anyway",
        1000,
      ),
    ).toEqual([{ company: "Padaria", cnpj: undefined }]);
  });

  it("drops an invalid CNPJ so the row can still enter", () => {
    const input = { company: "Padaria", cnpj: "123456789012345" };
    const mapped = mapImportLead(input);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.lead.cnpj).toBeUndefined();
    expect(mapped.lead.company_name).toBe("Padaria");
    expect(withoutInvalidCnpj(input).cnpj).toBeUndefined();
  });

  it("keeps a valid CNPJ", () => {
    const input = { company: "Padaria", cnpj: "12345678000195" };
    expect(withoutInvalidCnpj(input)).toEqual(input);
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

  it("keeps kind and form answers from the inbound payload", () => {
    const input = inboundPayloadToInput({
      kind: "person",
      name: "João da Silva",
      answers: { "Qual plano?": "Ouro" },
    });
    expect(input.kind).toBe("person");
    expect(input.answers).toEqual({ "Qual plano?": "Ouro" });
    const mapped = mapImportLead(input, { kind: "company" });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.lead.kind).toBe("person");
    expect(mapped.lead.answers).toEqual({ "Qual plano?": "Ouro" });
    expect(mapped.lead.cnpj).toBeUndefined();
  });

  it("keeps kind and form answers from the inbound payload", () => {
    const input = inboundPayloadToInput({
      kind: "person",
      name: "João da Silva",
      answers: { "Qual plano?": "Ouro" },
    });
    expect(input.kind).toBe("person");
    expect(input.answers).toEqual({ "Qual plano?": "Ouro" });
    const mapped = mapImportLead(input, { kind: "company" });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.lead.kind).toBe("person");
    expect(mapped.lead.answers).toEqual({ "Qual plano?": "Ouro" });
    expect(mapped.lead.cnpj).toBeUndefined();
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

  it("rejects a live note used as the company name", () => {
    const mapped = mapImportLead({
      company: "Isabela atendeu disse que contato só por email com o marcos",
      notes: "live 22/05",
    });
    expect(mapped).toEqual({ ok: false, message: IMPORT_NOTE_NAME_MESSAGE });
  });

  it("keeps sócios, drops sentry mail and não encontrado Instagram", () => {
    const mapped = mapImportLead({
      company: "Metalúrgica Vaz",
      phone: "31 3434-3084, 1746169634904",
      email: "contato@metalurgicavaz.com.br, 8eb368@sentry.wixpress.com",
      people: "PAULO AFONSO VAZ / MARIA VAZ",
      instagram: "não encontrado",
      website: "http://www.metalurgicavaz.com.br/",
      address: "Rod. Anel Rodoviário, 24277",
    });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.lead.phones).toEqual(["(31) 3434-3084"]);
    expect(mapped.lead.people[0]?.email).toBe("contato@metalurgicavaz.com.br");
    expect(mapped.lead.people.map((person) => person.name)).toEqual([
      "PAULO AFONSO VAZ",
      "MARIA VAZ",
    ]);
    expect(mapped.lead.notes).toMatch(/^Site: http:\/\/www\.metalurgicavaz\.com\.br$/m);
    expect(mapped.lead.notes).toMatch(/Endereço: Rod\. Anel Rodoviário/);
    expect(mapped.lead.notes).not.toMatch(/Instagram/);
  });

  it("shortens a Maps title and salvages a CNPJ from another cell", () => {
    const mapped = mapImportLead({
      company: "Aço Mais Betim - Ferragens, Treliças, Arames, Vergalhões",
      cnpj: "20230728100708",
    });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.lead.company_name).toBe("Aço Mais Betim");
    expect(mapped.lead.notes).toMatch(/Nome no Maps:/);
    expect(mapped.lead.cnpj).toBeUndefined();

    const hydrated = hydrateImportRow(
      ["nome", "cnpj", "Telefone 2"],
      ["EP Blocos", "20230728100708", "11.222.333/0001-81"],
      ["company", "cnpj", "phone"],
    );
    expect(hydrated.cnpj).toBe("11222333000181");
    const salvaged = mapImportLead(hydrated);
    expect(salvaged.ok).toBe(true);
    if (!salvaged.ok) return;
    expect(salvaged.lead.cnpj).toBe("11222333000181");
  });
});
