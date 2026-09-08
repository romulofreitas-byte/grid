import { describe, expect, it } from "vitest";
import {
  mergePeopleWithSocios,
  peopleFromContactAndSocios,
  peopleFromDeal,
  peopleListsEqual,
  parseSecretaries,
  sanitizePeople,
  sanitizeSecretaries,
  snapshotContactName,
  socioNamesFromQsa,
} from "./people";

describe("crm people", () => {
  it("keeps secretaries off the people list", () => {
    expect(
      peopleFromDeal({
        contact_name: "Ana",
        secretaries: ["Bia", ""],
        people: [],
      }),
    ).toEqual([{ name: "Ana", phone: "", email: "" }]);
  });

  it("drops name-only extras that already live in secretaries", () => {
    expect(
      peopleFromDeal({
        contact_name: "Ana",
        secretaries: ["Bia"],
        people: [
          { name: "Ana", phone: "", email: "" },
          { name: "Bia", phone: "", email: "" },
          { name: "Carlos", phone: "(34) 99999-0000", email: "" },
        ],
      }),
    ).toEqual([
      { name: "Ana", phone: "", email: "" },
      { name: "Carlos", phone: "(34) 99999-0000", email: "" },
    ]);
  });

  it("keeps stored people and snapshots the principal for lead-sync", () => {
    const people = sanitizePeople([
      { name: "Carlos", phone: "(34) 99999-0000", email: "c@x.com" },
      { name: "Bia", phone: "", email: "" },
      { name: "", phone: "", email: "" },
    ]);
    expect(people).toHaveLength(2);
    expect(snapshotContactName(people)).toBe("Carlos");
  });

  it("parses legacy secretary strings and person objects", () => {
    expect(
      parseSecretaries(["Bia", { name: "Ana", phone: "1", email: "a@x.com" }]),
    ).toEqual([
      { name: "Bia", phone: "", email: "" },
      { name: "Ana", phone: "1", email: "a@x.com" },
    ]);
  });

  it("trims empty secretary names", () => {
    expect(sanitizeSecretaries([" Bia ", "", "Lúcia"])).toEqual([
      { name: "Bia", phone: "", email: "" },
      { name: "Lúcia", phone: "", email: "" },
    ]);
  });

  it("keeps secretary phone and email when sanitizing", () => {
    expect(
      sanitizeSecretaries([
        { name: " Bia ", phone: "(34) 99999-0000", email: "bia@x.com" },
      ]),
    ).toEqual([{ name: "Bia", phone: "(34) 99999-0000", email: "bia@x.com" }]);
  });

  it("skips holdings and gestão when listing QSA names for the ficha", () => {
    expect(
      socioNamesFromQsa([
        { nome: "JORGE ANDRADE", kind: "pessoa" },
        { nome: "ALPHA HOLDING LTDA", kind: "holding" },
        { nome: "GESTAO PATRIMONIAL", kind: "gestao" },
        { nome: "MARIA SILVA", kind: "pessoa" },
      ]),
    ).toEqual(["JORGE ANDRADE", "MARIA SILVA"]);
  });

  it("appends missing socios without touching filled contacts or secretaries", () => {
    expect(
      mergePeopleWithSocios(
        [{ name: "Jorge", phone: "(34) 1", email: "j@x.com" }],
        ["Jorge", "Maria", "Pedro"],
        [{ name: "Bia", phone: "", email: "" }],
      ),
    ).toEqual([
      { name: "Jorge", phone: "(34) 1", email: "j@x.com" },
      { name: "Maria", phone: "", email: "" },
      { name: "Pedro", phone: "", email: "" },
    ]);
  });

  it("builds people from the chosen contact plus remaining PF socios", () => {
    expect(
      peopleFromContactAndSocios("Jorge", [
        "Jorge",
        "ALPHA HOLDING LTDA",
        "Maria Silva",
      ]),
    ).toEqual([
      { name: "Jorge", phone: "", email: "" },
      { name: "Maria Silva", phone: "", email: "" },
    ]);
  });

  it("compares people lists by name phone and email", () => {
    const row = { name: "Ana", phone: "", email: "" };
    expect(peopleListsEqual([row], [row])).toBe(true);
    expect(peopleListsEqual([row], [{ ...row, phone: "1" }])).toBe(false);
  });
});
