import { uniquePhones } from "@/lib/crm/dial";
import {
  IMPORT_EMPTY_ROW_MESSAGE,
  IMPORT_INVALID_CNPJ_MESSAGE,
} from "@/lib/crm/import-issues";
import type { CrmLeadKind, CrmPerson } from "@/lib/crm/types";
import { phonesMatch } from "@/lib/phone";

export const IMPORT_FALLBACK_COMPANY = "Lead inbound";

const COMPANY_NAME_HINT =
  /\b(ltda|s\.?\s*a\.?|eireli|epp|slu|industria|indústria|comercio|comércio|metalurgic|servicos|serviços|associacao|associação|fundacao|fundação)\b/i;

export type ImportLeadInput = {
  company?: string;
  name?: string;
  phone?: string;
  email?: string;
  cnpj?: string;
  notes?: string;
  kind?: CrmLeadKind;
  answers?: Record<string, string>;
};

export type MappedImportLead = {
  company_name: string;
  contact_name: string;
  phones: string[];
  people: CrmPerson[];
  cnpj?: string;
  notes: string;
  kind: CrmLeadKind;
  answers?: Record<string, string>;
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

export function looksLikeCompanyName(value: string): boolean {
  return COMPANY_NAME_HINT.test(value.trim());
}

export function pipelineNomeFromFile(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  return (base || "Lista importada").slice(0, 80);
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

function sampleCell(rows: string[][], index: number): string {
  for (const row of rows) {
    const value = (row[index] ?? "").trim();
    if (value) return value;
  }
  return "";
}

export function guessImportMapping(
  headers: string[],
  rows: string[][] = [],
): ImportColumnKey[] {
  const used = new Set<ImportColumnKey>();
  return headers.map((header, index) => {
    let guessed = guessImportColumn(header);
    if (guessed === "name" && !used.has("company")) {
      const sample = sampleCell(rows, index);
      if (looksLikeCompanyName(sample)) guessed = "company";
    }
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

export function parseFormAnswers(
  raw: unknown,
): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  let total = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= 20) break;
    const label = key.trim().slice(0, 80);
    if (!label) continue;
    const text =
      typeof value === "string"
        ? value.trim()
        : typeof value === "number" && Number.isFinite(value)
          ? String(value)
          : "";
    if (!text) continue;
    const clipped = text.slice(0, 200);
    if (total + clipped.length > 2000) break;
    out[label] = clipped;
    total += clipped.length;
  }
  return Object.keys(out).length ? out : undefined;
}

export function parseLeadKind(raw: unknown): CrmLeadKind | undefined {
  if (raw === "company" || raw === "empresa") return "company";
  if (raw === "person" || raw === "pessoa") return "person";
  return undefined;
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
    kind: parseLeadKind(record.kind ?? folded.kind),
    answers: parseFormAnswers(record.answers ?? folded.answers),
  };
}

export function parseImportCnpj(raw: string | undefined): {
  cnpj?: string;
  error?: string;
} {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return {};
  if (digits.length > 14) return { error: IMPORT_INVALID_CNPJ_MESSAGE };
  const padded = digits.padStart(14, "0");
  if (!/^\d{14}$/.test(padded)) return { error: IMPORT_INVALID_CNPJ_MESSAGE };
  return { cnpj: padded };
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function inferLeadKind(
  input: ImportLeadInput,
  fallback?: CrmLeadKind,
): CrmLeadKind {
  if (input.kind === "company" || input.kind === "person") return input.kind;
  if (fallback) return fallback;
  if (input.cnpj?.trim() || input.company?.trim()) return "company";
  if (input.name && looksLikeCompanyName(input.name)) return "company";
  if (input.name?.trim() && !input.company?.trim()) return "person";
  return "company";
}

export function mapImportLead(
  input: ImportLeadInput,
  opts?: { kind?: CrmLeadKind },
): MapLeadResult {
  const kind = inferLeadKind(input, opts?.kind);
  const company = clip(input.company ?? "", 120);
  const name = clip(input.name ?? "", 80);
  const email = clip(input.email ?? "", 120);
  const notes = clip(input.notes ?? "", 4000);
  const phoneRaw = clip(input.phone ?? "", 40);
  const parsedCnpj = kind === "person" ? {} : parseImportCnpj(input.cnpj);
  if (parsedCnpj.error) return { ok: false, message: parsedCnpj.error };
  const cnpj = parsedCnpj.cnpj;
  if (!company && !name && !email && !phoneRaw && !cnpj && !notes) {
    return { ok: false, message: IMPORT_EMPTY_ROW_MESSAGE };
  }
  const nameIsCompany = !company && Boolean(name) && looksLikeCompanyName(name);
  const company_name =
    kind === "person"
      ? name || email || IMPORT_FALLBACK_COMPANY
      : company || (nameIsCompany ? name : "") || name || email || IMPORT_FALLBACK_COMPANY;
  const contact_name =
    kind === "person" ? name : nameIsCompany ? "" : name;
  const phones = uniquePhones(phoneRaw ? [phoneRaw] : []).slice(0, 8);
  const phone = phones[0] ?? "";
  const people: CrmPerson[] = [
    {
      name: contact_name,
      phone: phone.slice(0, 24),
      email,
    },
  ];
  return {
    ok: true,
    lead: {
      company_name: company_name.slice(0, 120),
      contact_name,
      phones,
      people,
      cnpj: kind === "person" ? undefined : cnpj,
      notes,
      kind,
      answers: input.answers,
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
