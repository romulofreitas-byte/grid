import {
  mergeSourcedPhones,
  type CrmPhoneSourceKind,
  type CrmSourcedPhone,
} from "@/lib/crm/briefing";
import { phonesMatch } from "@/lib/phone";

export type CompanyPhoneRole = "secretary" | "person";

export type CompanyPhonePerson = {
  name: string;
  phone: string;
  role: CompanyPhoneRole;
};

export type CompanyPhoneMenuRow = {
  phone: string;
  hint: string;
  personOnly: boolean;
};

function samePhone(a: string, b: string): boolean {
  return a === b || phonesMatch(a, b);
}

function personLabel(
  person: CompanyPhonePerson,
  emptyNameHints: Record<CompanyPhoneRole, string>,
): string {
  const name = person.name.trim();
  return name || emptyNameHints[person.role];
}

function matchingPerson(
  phone: string,
  people: readonly CompanyPhonePerson[],
): CompanyPhonePerson | null {
  for (const person of people) {
    const value = person.phone.trim();
    if (!value) continue;
    if (samePhone(value, phone)) return person;
  }
  return null;
}

export function companyPhoneMenuOptions(input: {
  savedPhones: readonly string[];
  sourced: readonly CrmSourcedPhone[];
  people: readonly CompanyPhonePerson[];
  sourceHints: Record<CrmPhoneSourceKind, string>;
  emptyNameHints: Record<CompanyPhoneRole, string>;
}): CompanyPhoneMenuRow[] {
  const merged = mergeSourcedPhones([
    ...input.savedPhones.map((phone) => ({ phone, source: "crm" as const })),
    ...input.sourced,
  ]);
  const rows: CompanyPhoneMenuRow[] = merged.map((row) => {
    const person = matchingPerson(row.phone, input.people);
    const hint =
      row.source === "crm" && person
        ? personLabel(person, input.emptyNameHints)
        : input.sourceHints[row.source];
    return { phone: row.phone, hint, personOnly: false };
  });

  for (const person of input.people) {
    const phone = person.phone.trim();
    if (!phone) continue;
    if (rows.some((row) => samePhone(row.phone, phone))) continue;
    rows.push({
      phone,
      hint: personLabel(person, input.emptyNameHints),
      personOnly: true,
    });
  }

  return rows;
}

export function selectedCompanyPhone(
  savedPhones: readonly string[],
  rows: readonly CompanyPhoneMenuRow[],
): string {
  const saved = savedPhones.map((phone) => phone.trim()).find(Boolean) ?? "";
  if (saved) {
    const match = rows.find((row) => samePhone(row.phone, saved));
    return match?.phone ?? saved;
  }
  return rows.find((row) => !row.personOnly)?.phone ?? "";
}
