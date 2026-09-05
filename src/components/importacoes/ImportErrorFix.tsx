"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import { mapImportLead, parseImportCnpj, type ImportLeadInput } from "@/lib/crm/import";
import {
  IMPORT_RUNS_QUERY_KEY,
  importErrorCsvFilename,
  importErrorRowsCsv,
  type PublicImportRunDetail,
} from "@/lib/crm/import-history";
import {
  IMPORT_ERROR_FIX_LIMIT,
  IMPORT_INVALID_CNPJ_MESSAGE,
  IMPORT_ISSUE_FIELD_LABEL,
  IMPORT_ISSUE_FIELDS,
  correctionFileName,
  groupImportIssues,
  importIssueDiagnosis,
  issueGroupLabel,
  type ImportIssueField,
  type ImportIssueKind,
} from "@/lib/crm/import-issues";
import type { CrmImportRunIssue } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

const INPUT =
  "w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-1.5 text-xs text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

const FIELD_MAX: Record<ImportIssueField, number> = {
  company: 120,
  name: 80,
  phone: 40,
  email: 120,
  cnpj: 32,
};

type Draft = Record<ImportIssueField, string>;

function issueDraft(issue: CrmImportRunIssue): Draft {
  return {
    company: issue.company,
    name: issue.name,
    phone: issue.phone,
    email: issue.email,
    cnpj: issue.cnpj,
  };
}

function draftToInput(draft: Draft): ImportLeadInput {
  return {
    company: draft.company.trim() || undefined,
    name: draft.name.trim() || undefined,
    phone: draft.phone.trim() || undefined,
    email: draft.email.trim() || undefined,
    cnpj: draft.cnpj.trim() || undefined,
  };
}

function fieldNeedsAttention(
  kind: ImportIssueKind,
  field: ImportIssueField,
  value: string,
): boolean {
  if (!kind.highlight.includes(field)) return false;
  if (kind.code === "invalid_cnpj") {
    return Boolean(value.trim()) && Boolean(parseImportCnpj(value).error);
  }
  return !value.trim();
}

function downloadErrors(run: PublicImportRunDetail) {
  const csv = importErrorRowsCsv(run.issues);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = importErrorCsvFilename(run.file_name);
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportErrorFix({ run }: { run: PublicImportRunDetail }) {
  const queryClient = useQueryClient();
  const errors = useMemo(
    () => run.issues.filter((issue) => issue.status === "error"),
    [run.issues],
  );
  const editable = errors.slice(0, IMPORT_ERROR_FIX_LIMIT);
  const editableRows = useMemo(
    () => new Set(editable.map((issue) => issue.row)),
    [editable],
  );
  const groups = useMemo(() => groupImportIssues(errors), [errors]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() =>
    Object.fromEntries(editable.map((issue) => [issue.row, issueDraft(issue)])),
  );

  const readyRows = editable.filter((issue) => {
    const draft = drafts[issue.row] ?? issueDraft(issue);
    return mapImportLead(draftToInput(draft)).ok;
  });

  const send = useMutation({
    mutationFn: async () => {
      const rows = readyRows.map((issue) =>
        draftToInput(drafts[issue.row] ?? issueDraft(issue)),
      );
      if (rows.length === 0) {
        throw new Error(COPY.importacoesFixesNoneReady);
      }
      const res = await fetch("/api/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline_id: run.pipeline_id,
          file_name: correctionFileName(run.file_name),
          rows,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível enviar as correções");
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: IMPORT_RUNS_QUERY_KEY });
    },
  });

  function patchDraft(row: number, field: ImportIssueField, value: string) {
    setDrafts((current) => {
      const previous = current[row] ?? {
        company: "",
        name: "",
        phone: "",
        email: "",
        cnpj: "",
      };
      return { ...current, [row]: { ...previous, [field]: value } };
    });
  }

  const canSend = Boolean(run.pipeline_id) && readyRows.length > 0 && !send.isPending;

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const visible = group.issues.filter((issue) => editableRows.has(issue.row));
        return (
          <div key={group.kind.code === "unknown" ? group.kind.title : group.kind.code}>
            <p className="text-sm font-semibold text-podium-white">
              {issueGroupLabel(group.kind, group.issues.length)}
            </p>
            <Hint className="mt-1">{group.kind.action}</Hint>
            {visible.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {visible.map((issue) => (
                  <ErrorRow
                    key={issue.row}
                    issue={issue}
                    kind={group.kind}
                    draft={drafts[issue.row] ?? issueDraft(issue)}
                    onChange={(field, value) => patchDraft(issue.row, field, value)}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
      {errors.length > editable.length ? (
        <p className="text-[11px] text-podium-muted">
          {COPY.importacoesFixesShown
            .replace("{shown}", String(editable.length))
            .replace("{total}", String(errors.length))}
        </p>
      ) : null}
      {run.pipeline_id ? (
        <div className="space-y-2">
          {readyRows.length > 0 && readyRows.length < editable.length ? (
            <p className="text-[11px] text-podium-muted">
              {COPY.importacoesFixesPartial
                .replace("{ready}", String(readyRows.length))
                .replace("{total}", String(editable.length))}
            </p>
          ) : null}
          {readyRows.length === 0 ? (
            <p className="text-[11px] text-podium-muted">
              {editable.some((issue) => {
                const draft = drafts[issue.row] ?? issueDraft(issue);
                const mapped = mapImportLead(draftToInput(draft));
                return !mapped.ok && mapped.message === IMPORT_INVALID_CNPJ_MESSAGE;
              })
                ? COPY.importacoesFixesCnpjBlocked
                : COPY.importacoesFixesNoneReady}
            </p>
          ) : null}
          <Button
            variant="primary"
            disabled={!canSend}
            onClick={() => send.mutate()}
          >
            {send.isPending
              ? COPY.importacoesSendingFixes
              : readyRows.length === 0
                ? COPY.importacoesSendFixes
                : readyRows.length === 1
                  ? COPY.importacoesSendFixesOne
                  : COPY.importacoesSendFixesMany.replace("{n}", String(readyRows.length))}
          </Button>
          {send.isError ? (
            <p className="text-sm text-podium-alert">{(send.error as Error).message}</p>
          ) : null}
        </div>
      ) : null}
      <div>
        <Button variant="secondary" onClick={() => downloadErrors(run)}>
          {COPY.importacoesDownloadErrors}
        </Button>
        <Hint className="mt-2">{COPY.importacoesFixHint}</Hint>
      </div>
    </div>
  );
}

function ErrorRow({
  issue,
  kind,
  draft,
  onChange,
}: {
  issue: CrmImportRunIssue;
  kind: ImportIssueKind;
  draft: Draft;
  onChange: (field: ImportIssueField, value: string) => void;
}) {
  const diagnosis = importIssueDiagnosis(issue);
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[11px] font-semibold text-podium-white">Linha {issue.row}</p>
      {diagnosis ? (
        <p className="mt-0.5 text-[11px] text-podium-muted">{diagnosis}</p>
      ) : null}
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {IMPORT_ISSUE_FIELDS.map((field) => {
          const alert = fieldNeedsAttention(kind, field, draft[field]);
          return (
            <label key={field} className="block min-w-0">
              <span className="text-[10px] text-podium-muted">
                {IMPORT_ISSUE_FIELD_LABEL[field]}
              </span>
              <input
                className={cn(
                  INPUT,
                  "mt-0.5",
                  alert && "border-podium-alert/50 focus:border-podium-alert/70",
                )}
                value={draft[field]}
                maxLength={FIELD_MAX[field]}
                onChange={(event) => onChange(field, event.target.value)}
                aria-invalid={alert || undefined}
              />
            </label>
          );
        })}
      </div>
    </li>
  );
}
