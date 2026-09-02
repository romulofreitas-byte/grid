import type { CrmPerson } from "@/lib/crm/types";

export function emptyPerson(): CrmPerson {
  return { name: "", phone: "", email: "" };
}

export function parsePeople(value: unknown): CrmPerson[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    if (!row || typeof row !== "object") return emptyPerson();
    const raw = row as Record<string, unknown>;
    return {
      name: typeof raw.name === "string" ? raw.name : "",
      phone: typeof raw.phone === "string" ? raw.phone : "",
      email: typeof raw.email === "string" ? raw.email : "",
    };
  });
}

export function sanitizePeople(people: CrmPerson[]): CrmPerson[] {
  const cleaned = people.map((person) => ({
    name: person.name.trim().slice(0, 80),
    phone: person.phone.trim().slice(0, 24),
    email: person.email.trim().slice(0, 120),
  }));
  const primary = cleaned[0] ?? emptyPerson();
  const extras = cleaned
    .slice(1)
    .filter((person) => person.name || person.phone || person.email);
  return [primary, ...extras];
}

export function sanitizeSecretaries(values: string[]): string[] {
  return values
    .map((value) => value.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 8);
}

function secretaryNames(values: string[]): Set<string> {
  return new Set(
    values.map((value) => value.trim()).filter(Boolean),
  );
}

export function peopleFromDeal(deal: {
  contact_name: string;
  secretaries: string[];
  people?: CrmPerson[] | unknown;
}): CrmPerson[] {
  const stored = sanitizePeople(parsePeople(deal.people));
  const names = secretaryNames(deal.secretaries);
  if (stored.some((person) => person.name || person.phone || person.email)) {
    const primary = stored[0] ?? emptyPerson();
    const extras = stored.slice(1).filter((person) => {
      const nameOnly = Boolean(person.name) && !person.phone && !person.email;
      if (nameOnly && names.has(person.name.trim())) return false;
      return person.name || person.phone || person.email;
    });
    return sanitizePeople([primary, ...extras]);
  }
  return sanitizePeople([
    { name: deal.contact_name, phone: "", email: "" },
  ]);
}

export function snapshotContactName(people: CrmPerson[]): string {
  return people[0]?.name.trim() ?? "";
}
