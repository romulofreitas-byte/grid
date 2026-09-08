import { isPessoaFisica } from "@/lib/partner-kind";
import type { CrmPerson } from "@/lib/crm/types";

export function emptyPerson(): CrmPerson {
  return { name: "", phone: "", email: "" };
}

function asPerson(row: unknown): CrmPerson {
  if (typeof row === "string") {
    return { name: row, phone: "", email: "" };
  }
  if (!row || typeof row !== "object") return emptyPerson();
  const raw = row as Record<string, unknown>;
  return {
    name: typeof raw.name === "string" ? raw.name : "",
    phone: typeof raw.phone === "string" ? raw.phone : "",
    email: typeof raw.email === "string" ? raw.email : "",
  };
}

export function parsePeople(value: unknown): CrmPerson[] {
  if (!Array.isArray(value)) return [];
  return value.map(asPerson);
}

export function parseSecretaries(value: unknown): CrmPerson[] {
  if (!Array.isArray(value)) return [];
  return value.map(asPerson);
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

export function sanitizeSecretaries(values: unknown): CrmPerson[] {
  return parseSecretaries(values)
    .map((person) => ({
      name: person.name.trim().slice(0, 80),
      phone: person.phone.trim().slice(0, 24),
      email: person.email.trim().slice(0, 120),
    }))
    .filter((person) => person.name || person.phone || person.email)
    .slice(0, 8);
}

function secretaryNameSet(secretaries: CrmPerson[]): Set<string> {
  return new Set(
    secretaries.map((person) => person.name.trim()).filter(Boolean),
  );
}

export function peopleFromDeal(deal: {
  contact_name: string;
  secretaries?: unknown;
  people?: CrmPerson[] | unknown;
}): CrmPerson[] {
  const stored = sanitizePeople(parsePeople(deal.people));
  const names = secretaryNameSet(sanitizeSecretaries(deal.secretaries));
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

export function peopleListsEqual(a: CrmPerson[], b: CrmPerson[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((person, index) => {
    const other = b[index];
    return (
      person.name === other?.name &&
      person.phone === other.phone &&
      person.email === other.email
    );
  });
}

export function socioNamesFromQsa(
  rows:
    | Array<{
        nome: string;
        kind?: string | null;
        faixaEtaria?: number | null;
        faixa_etaria?: number | null;
      }>
    | null
    | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows ?? []) {
    const nome = row.nome.trim().slice(0, 80);
    if (!nome) continue;
    const pessoa =
      row.kind === "pessoa" ||
      ((row.kind == null || row.kind === "") &&
        isPessoaFisica(nome, row.faixaEtaria ?? row.faixa_etaria ?? null));
    if (!pessoa) continue;
    const key = nome.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(nome);
  }
  return out;
}

export function socioNamesForBriefing(
  partners: Array<{ nome: string; faixa_etaria?: number | null }>,
  decisor: string | null,
): string[] {
  const names = socioNamesFromQsa(
    partners.map((partner) => ({
      nome: partner.nome,
      faixa_etaria: partner.faixa_etaria,
    })),
  );
  if (names.length) return names;
  return socioNamesFromQsa([{ nome: decisor ?? "", kind: "pessoa" }]);
}

export function mergePeopleWithSocios(
  people: CrmPerson[],
  socios: readonly string[],
  secretaries: unknown,
): CrmPerson[] {
  const current = sanitizePeople(people);
  const taken = new Set<string>();
  for (const person of current) {
    const key = person.name.trim().toLowerCase();
    if (key) taken.add(key);
  }
  for (const person of sanitizeSecretaries(secretaries)) {
    const key = person.name.trim().toLowerCase();
    if (key) taken.add(key);
  }
  const extras: CrmPerson[] = [];
  for (const raw of socios) {
    const name = raw.trim().slice(0, 80);
    if (!name) continue;
    const key = name.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    extras.push({ name, phone: "", email: "" });
  }
  return sanitizePeople([...current, ...extras]).slice(0, 12);
}

export function peopleFromContactAndSocios(
  contactName: string,
  socioNames: readonly string[],
): CrmPerson[] {
  const pf = socioNamesFromQsa(socioNames.map((nome) => ({ nome })));
  const primary = contactName.trim() || pf[0] || "";
  return mergePeopleWithSocios(
    [{ name: primary, phone: "", email: "" }],
    pf,
    [],
  );
}
