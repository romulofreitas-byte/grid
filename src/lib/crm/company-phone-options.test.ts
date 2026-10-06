import { describe, expect, it } from "vitest";
import {
  companyPhoneMenuOptions,
  selectedCompanyPhone,
  type CompanyPhoneMenuRow,
} from "./company-phone-options";

const sourceHints = {
  site: "Site",
  receita: "Receita",
  maps: "Maps",
  crm: "CRM",
};

const emptyNameHints = {
  secretary: "Secretária",
  person: "Sócio",
};

function menu(input: {
  savedPhones?: string[];
  sourced?: { phone: string; source: "site" | "receita" | "maps" | "crm" }[];
  people?: { name: string; phone: string; role: "secretary" | "person" }[];
}): CompanyPhoneMenuRow[] {
  return companyPhoneMenuOptions({
    savedPhones: input.savedPhones ?? [],
    sourced: input.sourced ?? [],
    people: input.people ?? [],
    sourceHints,
    emptyNameHints,
  });
}

describe("company phone menu", () => {
  it("keeps the site label when the same number also belongs to a person", () => {
    const rows = menu({
      sourced: [{ phone: "(33) 3344-1405", source: "site" }],
      people: [{ name: "Maria", phone: "3333441405", role: "person" }],
    });
    expect(rows).toEqual([
      { phone: "(33) 3344-1405", hint: "Site", personOnly: false },
    ]);
  });

  it("lists a person number after the company number, with the person's name", () => {
    const rows = menu({
      sourced: [{ phone: "(33) 3344-1405", source: "site" }],
      people: [
        { name: "Ana", phone: "(33) 98888-0000", role: "secretary" },
        { name: "", phone: "(33) 97777-0000", role: "person" },
        { name: "", phone: "(33) 96666-0000", role: "secretary" },
      ],
    });
    expect(rows.map((row) => [row.phone, row.hint, row.personOnly])).toEqual([
      ["(33) 3344-1405", "Site", false],
      ["(33) 98888-0000", "Ana", true],
      ["(33) 97777-0000", "Sócio", true],
      ["(33) 96666-0000", "Secretária", true],
    ]);
  });

  it("shows the person name when that number is only stored as CRM", () => {
    const rows = menu({
      sourced: [{ phone: "(11) 99999-0000", source: "crm" }],
      people: [{ name: "Carlos", phone: "(11) 99999-0000", role: "person" }],
    });
    expect(rows).toEqual([
      { phone: "(11) 99999-0000", hint: "Carlos", personOnly: false },
    ]);
  });

  it("drops a repeated person number and keeps a company-only number as CRM", () => {
    const rows = menu({
      savedPhones: ["(11) 4123-3244"],
      people: [
        { name: "Bia", phone: "(11) 98888-0000", role: "secretary" },
        { name: "Rita", phone: "11988880000", role: "person" },
      ],
    });
    expect(rows).toEqual([
      { phone: "(11) 4123-3244", hint: "CRM", personOnly: false },
      { phone: "(11) 98888-0000", hint: "Bia", personOnly: true },
    ]);
  });

  it("does not select a person number until it is saved on the company", () => {
    const rows = menu({
      sourced: [{ phone: "(33) 3344-1405", source: "site" }],
      people: [{ name: "Ana", phone: "(33) 98888-0000", role: "secretary" }],
    });
    expect(selectedCompanyPhone([""], rows)).toBe("(33) 3344-1405");
    expect(selectedCompanyPhone([], rows)).toBe("(33) 3344-1405");
    expect(
      selectedCompanyPhone(["(33) 98888-0000"], rows),
    ).toBe("(33) 98888-0000");
    const peopleOnly = menu({
      people: [{ name: "Ana", phone: "(33) 98888-0000", role: "secretary" }],
    });
    expect(selectedCompanyPhone([], peopleOnly)).toBe("");
  });
});
