import type { ImportLeadInput } from "@/lib/crm/import";
import type { ImportApplyResult } from "@/lib/crm/import-apply";
import type {
  CrmImportRun,
  CrmImportRunIssue,
  CrmImportRunIssueStatus,
} from "@/lib/crm/types";

export const IMPORT_RUN_LIST_LIMIT = 20;
export const IMPORT_RUN_KEEP = 50;
export const IMPORT_SKIPPED_MESSAGE = "Já estava no quadro";

export type PublicImportRun = {
  id: string;
  pipeline_id: string | null;
  pipeline_nome: string;
  file_name: string | null;
  created: number;
  skipped: number;
  error_count: number;
  matched_cnpjs: number;
  list_id: string | null;
  qualified: number;
  created_at: string;
};

export type PublicImportRunDetail = PublicImportRun & {
  issues: CrmImportRunIssue[];
};

export function clipImportField(value: string | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}

export function snapshotImportIssue(
  row: ImportLeadInput | undefined,
  issue: {
    row: number;
    status: CrmImportRunIssueStatus;
    message: string;
  },
): CrmImportRunIssue {
  return {
    row: issue.row,
    status: issue.status,
    message: clipImportField(issue.message, 200),
    company: clipImportField(row?.company, 120),
    name: clipImportField(row?.name, 80),
    phone: clipImportField(row?.phone, 40),
    email: clipImportField(row?.email, 120),
    cnpj: clipImportField(row?.cnpj, 32),
  };
}

export function issuesFromApply(
  rows: ImportLeadInput[],
  result: ImportApplyResult,
): CrmImportRunIssue[] {
  return result.issues.map((issue) =>
    snapshotImportIssue(rows[issue.row - 1], issue),
  );
}

export function toPublicImportRun(run: CrmImportRun): PublicImportRun {
  return {
    id: run.id,
    pipeline_id: run.pipeline_id,
    pipeline_nome: run.pipeline_nome,
    file_name: run.file_name,
    created: run.created,
    skipped: run.skipped,
    error_count: run.error_count,
    matched_cnpjs: run.matched_cnpjs,
    list_id: run.list_id,
    qualified: run.qualified,
    created_at: run.created_at,
  };
}

export function toPublicImportRunDetail(
  run: CrmImportRun,
): PublicImportRunDetail {
  return { ...toPublicImportRun(run), issues: run.issues };
}

export function importRunTone(
  run: Pick<PublicImportRun, "created" | "skipped" | "error_count">,
): "success" | "warning" | "neutral" {
  if (run.error_count > 0) return "warning";
  if (run.created > 0) return "success";
  return "neutral";
}

function parseIssueStatus(value: unknown): CrmImportRunIssueStatus | null {
  return value === "error" || value === "skipped" ? value : null;
}

export function parseImportRunIssues(raw: unknown): CrmImportRunIssue[] {
  if (!Array.isArray(raw)) return [];
  const out: CrmImportRunIssue[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const status = parseIssueStatus(row.status);
    const index = Number(row.row);
    if (!status || !Number.isInteger(index) || index < 1) continue;
    out.push({
      row: index,
      status,
      message: clipImportField(String(row.message ?? ""), 200),
      company: clipImportField(String(row.company ?? ""), 120),
      name: clipImportField(String(row.name ?? ""), 80),
      phone: clipImportField(String(row.phone ?? ""), 40),
      email: clipImportField(String(row.email ?? ""), 120),
      cnpj: clipImportField(String(row.cnpj ?? ""), 32),
    });
    if (out.length >= 500) break;
  }
  return out;
}

function csvCell(value: string): string {
  if (/[",\n\r;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function importErrorRowsCsv(issues: CrmImportRunIssue[]): string {
  const rows = issues.filter((issue) => issue.status === "error");
  const header = [
    "linha",
    "erro",
    "empresa",
    "nome",
    "telefone",
    "email",
    "cnpj",
  ];
  const lines = [
    header.join(";"),
    ...rows.map((issue) =>
      [
        String(issue.row),
        issue.message,
        issue.company,
        issue.name,
        issue.phone,
        issue.email,
        issue.cnpj,
      ]
        .map(csvCell)
        .join(";"),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

export function importErrorCsvFilename(fileName: string | null): string {
  const base = (fileName ?? "importacao")
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `erros-${base || "importacao"}.csv`;
}
