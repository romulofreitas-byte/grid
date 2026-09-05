import { uniquePhones } from "@/lib/crm/dial";
import type { CrmPerson } from "@/lib/crm/types";
import { phonesMatch } from "@/lib/phone";

export const IMPORT_FALLBACK_COMPANY = "Lead inbound";

export type ImportLeadInput = {
  company?: string;
  name?: string;
  phone?: string;
  email?: string;
  cnpj?: string;
  notes?: string;
};

export type MappedImportLead = {
  company_name: string;
  contact_name: string;
  phones: string[];
  people: CrmPerson[];
  cnpj?: string;
  notes: string;
};

export type MapLeadResult =
  | { ok: true; lead: MappedImportLead }
  | { ok: false; message: string };

export type ImportColumnKey =
  | "company"
  | "name"
  | "phone"
  | "email"
  | "cnpj"
  | "notes"
  | "skip";

const HEADER_ALIASES: Record<Exclude<ImportColumnKey, "skip">, string[]> = {
  company: [
    "company",
    "company_name",
    "empresa",
    "razao",
    "razao_social",
    "nome_fantasia",
    "organizacao",
    "organization",
  ],
  name: [
    "name",
    "full_name",
    "nome",
    "contato",
    "contact",
    "contact_name",
    "decisor",
    "pessoa",
  ],
  phone: [
    "phone",
    "telefone",
    "tel",
    "celular",
    "whatsapp",
    "mobile",
    "fone",
  ],
  email: ["email", "e_mail", "mail", "e-mail"],
  cnpj: ["cnpj"],
  notes: [
    "notes",
    "notas",
    "obs",
    "observacao",
    "observacoes",
    "mensagem",
    "message",
    "comentario",
    "comentarios",
    "comment",
    "comments",
    "anotacao",
    "anotacoes",
    "historico",
    "descricao",
    "description",
    "annotations",
    "follow_up",
    "followup",
  ],
};

export function foldImportHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function guessImportColumn(header: string): ImportColumnKey {
  const folded = foldImportHeader(header);
  if (!folded) return "skip";
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<
    [Exclude<ImportColumnKey, "skip">, string[]]
  >) {
    if (aliases.some((alias) => folded === alias || folded.startsWith(`${alias}_`))) {
      return key;
    }
  }
  return "skip";
}

export function guessImportMapping(headers: string[]): ImportColumnKey[] {
  const used = new Set<ImportColumnKey>();
  return headers.map((header) => {
    const guessed = guessImportColumn(header);
    if (guessed === "skip") return "skip";
    if (guessed === "notes") return "notes";
    if (used.has(guessed)) return "skip";
    used.add(guessed);
    return guessed;
  });
}

function pickAlias(
  record: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value).trim();
    }
  }
  return "";
}

function pickJoinedAliases(
  record: Record<string, unknown>,
  keys: string[],
): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const raw = pickAlias(record, [key]);
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    parts.push(raw);
  }
  return parts.join(" · ");
}

/** Flat Make/Zapier/form payload → canonical import fields. */
export function inboundPayloadToInput(raw: unknown): ImportLeadInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  const folded: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    folded[foldImportHeader(key)] = value;
  }
  return {
    company: pickAlias(folded, HEADER_ALIASES.company) || undefined,
    name: pickAlias(folded, HEADER_ALIASES.name) || undefined,
    phone: pickAlias(folded, HEADER_ALIASES.phone) || undefined,
    email: pickAlias(folded, HEADER_ALIASES.email) || undefined,
    cnpj: pickAlias(folded, HEADER_ALIASES.cnpj) || undefined,
    notes: pickJoinedAliases(folded, HEADER_ALIASES.notes) || undefined,
  };
}

export function parseImportCnpj(raw: string | undefined): {
  cnpj?: string;
  error?: string;
} {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return {};
  if (digits.length > 14) return { error: "CNPJ inválido" };
  const padded = digits.padStart(14, "0");
  if (!/^\d{14}$/.test(padded)) return { error: "CNPJ inválido" };
  return { cnpj: padded };
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function mapImportLead(input: ImportLeadInput): MapLeadResult {
  const company = clip(input.company ?? "", 120);
  const name = clip(input.name ?? "", 80);
  const email = clip(input.email ?? "", 120);
  const notes = clip(input.notes ?? "", 4000);
  const phoneRaw = clip(input.phone ?? "", 40);
  const { cnpj, error } = parseImportCnpj(input.cnpj);
  if (error) return { ok: false, message: error };
  if (!company && !name && !email && !phoneRaw && !cnpj && !notes) {
    return { ok: false, message: "Linha vazia" };
  }
  const phones = uniquePhones(phoneRaw ? [phoneRaw] : []).slice(0, 8);
  const phone = phones[0] ?? "";
  const people: CrmPerson[] = [
    {
      name,
      phone: phone.slice(0, 24),
      email,
    },
  ];
  const company_name =
    company || name || email || IMPORT_FALLBACK_COMPANY;
  return {
    ok: true,
    lead: {
      company_name: company_name.slice(0, 120),
      contact_name: name,
      phones,
      people,
      cnpj,
      notes,
    },
  };
}

export function dealMatchesImportLead(
  deal: {
    cnpj: string | null;
    phones: string[];
    people: CrmPerson[];
  },
  lead: MappedImportLead,
): boolean {
  if (lead.cnpj && deal.cnpj === lead.cnpj) return true;
  const email = lead.people[0]?.email.trim().toLowerCase() ?? "";
  if (email) {
    const hit = deal.people.some(
      (person) => person.email.trim().toLowerCase() === email,
    );
    if (hit) return true;
  }
  const phone = lead.phones[0] ?? lead.people[0]?.phone ?? "";
  if (!phone) return false;
  const candidates = [
    ...deal.phones,
    ...deal.people.map((person) => person.phone),
  ];
  return candidates.some((existing) => phonesMatch(existing, phone));
}
