import { COPY } from "@/lib/copy";
import type { CrmImportRunIssue } from "@/lib/crm/types";

export const IMPORT_EMPTY_ROW_MESSAGE = "Linha vazia";
export const IMPORT_INVALID_CNPJ_MESSAGE = "CNPJ inválido";
export const IMPORT_CREATE_FAILED_MESSAGE = "Não foi possível criar o negócio.";

export const IMPORT_ERROR_FIX_LIMIT = 50;
export const IMPORT_CORRECTION_PREFIX = "correção · ";

export const IMPORT_ISSUE_CODES = [
  "empty_row",
  "invalid_cnpj",
  "create_failed",
  "unknown",
] as const;
export type ImportIssueCode = (typeof IMPORT_ISSUE_CODES)[number];

export const IMPORT_ISSUE_FIELDS = [
  "company",
  "name",
  "phone",
  "email",
  "cnpj",
] as const;
export type ImportIssueField = (typeof IMPORT_ISSUE_FIELDS)[number];

export const IMPORT_ISSUE_FIELD_LABEL: Record<ImportIssueField, string> = {
  company: "Empresa",
  name: "Nome",
  phone: "Telefone",
  email: "E-mail",
  cnpj: "CNPJ",
};

export type ImportIssueKind = {
  code: ImportIssueCode;
  title: string;
  action: string;
  highlight: ImportIssueField[];
};

export function classifyImportIssue(message: string): ImportIssueKind {
  if (message === IMPORT_EMPTY_ROW_MESSAGE) {
    return {
      code: "empty_row",
      title: COPY.importacoesIssueEmptyTitle,
      action: COPY.importacoesIssueEmptyAction,
      highlight: [...IMPORT_ISSUE_FIELDS],
    };
  }
  if (message === IMPORT_INVALID_CNPJ_MESSAGE) {
    return {
      code: "invalid_cnpj",
      title: COPY.importacoesIssueCnpjTitle,
      action: COPY.importacoesIssueCnpjAction,
      highlight: ["cnpj"],
    };
  }
  if (message === IMPORT_CREATE_FAILED_MESSAGE) {
    return {
      code: "create_failed",
      title: COPY.importacoesIssueCreateTitle,
      action: COPY.importacoesIssueCreateAction,
      highlight: [],
    };
  }
  return {
    code: "unknown",
    title: message.trim() || COPY.importacoesIssueUnknownTitle,
    action: COPY.importacoesIssueUnknownAction,
    highlight: [...IMPORT_ISSUE_FIELDS],
  };
}

export function emptyImportFields(
  issue: Pick<CrmImportRunIssue, ImportIssueField>,
): ImportIssueField[] {
  return IMPORT_ISSUE_FIELDS.filter((field) => !issue[field].trim());
}

export function joinPt(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

export function importIssueDiagnosis(issue: CrmImportRunIssue): string {
  const kind = classifyImportIssue(issue.message);
  if (kind.code === "empty_row") {
    const empty = emptyImportFields(issue);
    if (empty.length === 0) return "";
    return COPY.importacoesIssueEmptyFields.replace(
      "{fields}",
      joinPt(empty.map((field) => IMPORT_ISSUE_FIELD_LABEL[field])),
    );
  }
  if (kind.code === "invalid_cnpj") {
    const received = issue.cnpj.trim();
    const cnpjBit = received
      ? COPY.importacoesIssueCnpjReceived.replace("{value}", received)
      : COPY.importacoesIssueCnpjMissing;
    const who = [issue.company, issue.name].filter(Boolean).join(" · ");
    return who ? `${who} · ${cnpjBit}` : cnpjBit;
  }
  return [issue.company, issue.name, issue.cnpj].filter(Boolean).join(" · ");
}

export function groupImportIssues<T extends { message: string }>(
  issues: T[],
): Array<{ kind: ImportIssueKind; issues: T[] }> {
  const groups = new Map<string, { kind: ImportIssueKind; issues: T[] }>();
  const order: string[] = [];
  for (const issue of issues) {
    const kind = classifyImportIssue(issue.message);
    const key = kind.code === "unknown" ? `unknown:${kind.title}` : kind.code;
    let group = groups.get(key);
    if (!group) {
      group = { kind, issues: [] };
      groups.set(key, group);
      order.push(key);
    }
    group.issues.push(issue);
  }
  return order.map((key) => groups.get(key)!);
}

export function issueGroupLabel(kind: ImportIssueKind, count: number): string {
  const countLabel =
    count === 1
      ? COPY.importacoesIssueCountOne
      : COPY.importacoesIssueCountMany.replace("{n}", String(count));
  return `${kind.title} — ${countLabel}`;
}

export function correctionFileName(fileName: string | null): string {
  const raw = (fileName ?? "").trim();
  if (raw.startsWith(IMPORT_CORRECTION_PREFIX)) return raw.slice(0, 200);
  const base = raw || "importação";
  return `${IMPORT_CORRECTION_PREFIX}${base}`.slice(0, 200);
}
