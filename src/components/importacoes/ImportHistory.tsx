"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { ImportErrorFix } from "@/components/importacoes/ImportErrorFix";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { crmHref, gridHref } from "@/lib/back";
import { COPY } from "@/lib/copy";
import {
  IMPORT_RUNS_QUERY_KEY,
  importRunTone,
  type PublicImportRun,
  type PublicImportRunDetail,
} from "@/lib/crm/import-history";
import type { CrmImportRunIssue } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

export { IMPORT_RUNS_QUERY_KEY };

function statusLabel(run: Pick<PublicImportRun, "created" | "skipped" | "error_count">) {
  if (run.error_count > 0 && run.created === 0 && run.skipped === 0) {
    return COPY.importacoesStatusFailed;
  }
  if (run.error_count > 0) return COPY.importacoesStatusPartial;
  if (run.created > 0) return COPY.importacoesStatusOk;
  return COPY.importacoesStatusDupes;
}

function createdBadge(n: number) {
  return n === 1
    ? COPY.importacoesBadgeCreatedOne
    : COPY.importacoesBadgeCreatedMany.replace("{n}", String(n));
}

function skippedBadge(n: number) {
  return n === 1
    ? COPY.importacoesBadgeSkippedOne
    : COPY.importacoesBadgeSkippedMany.replace("{n}", String(n));
}

function errorBadge(n: number) {
  return n === 1
    ? COPY.importacoesBadgeErrorOne
    : COPY.importacoesBadgeErrorMany.replace("{n}", String(n));
}

function IssueList({
  issues,
  status,
}: {
  issues: CrmImportRunIssue[];
  status: CrmImportRunIssue["status"];
}) {
  const rows = issues.filter((issue) => issue.status === status).slice(0, 12);
  if (rows.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-[11px] text-podium-muted">
      {rows.map((issue) => (
        <li key={`${issue.status}-${issue.row}-${issue.message}`}>
          <span>
            Linha {issue.row}: {issue.message}
          </span>
          {issue.company || issue.name || issue.cnpj ? (
            <span className="block truncate pl-0 text-podium-muted">
              {[issue.company, issue.name, issue.cnpj].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function RunLinks({ run }: { run: PublicImportRun }) {
  return (
    <p className="mt-2 text-sm text-podium-gray">
      {run.pipeline_id ? (
        <Link
          href={crmHref({ pipeline: run.pipeline_id })}
          className="font-semibold text-podium-yellow"
        >
          Abrir o quadro
        </Link>
      ) : (
        <span>{run.pipeline_nome}</span>
      )}
      {run.list_id ? (
        <>
          {" · "}
          <Link
            href={gridHref(run.list_id, "listas")}
            className="font-semibold text-podium-yellow"
          >
            Abrir a lista
          </Link>
        </>
      ) : null}
    </p>
  );
}

function RunBadges({ run }: { run: PublicImportRun }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      <Badge variant={importRunTone(run)}>{statusLabel(run)}</Badge>
      {run.created > 0 ? (
        <Badge variant="success">{createdBadge(run.created)}</Badge>
      ) : null}
      {run.skipped > 0 ? (
        <Badge variant="neutral">{skippedBadge(run.skipped)}</Badge>
      ) : null}
      {run.error_count > 0 ? (
        <Badge variant="warning">{errorBadge(run.error_count)}</Badge>
      ) : null}
    </div>
  );
}

export function ImportHistory() {
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useQuery({
    queryKey: IMPORT_RUNS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/crm/import");
      const json = (await res.json()) as {
        runs?: PublicImportRun[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível ler o histórico");
      return json.runs ?? [];
    },
  });

  const last = list.data?.[0] ?? null;
  const older = list.data?.slice(1) ?? [];

  const lastDetail = useQuery({
    queryKey: [...IMPORT_RUNS_QUERY_KEY, last?.id],
    enabled: Boolean(last?.id),
    queryFn: async () => {
      const res = await fetch(`/api/crm/import/${last!.id}`);
      const json = (await res.json()) as {
        run?: PublicImportRunDetail;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível abrir a importação");
      return json.run!;
    },
  });

  const olderDetail = useQuery({
    queryKey: [...IMPORT_RUNS_QUERY_KEY, openId],
    enabled: Boolean(openId),
    queryFn: async () => {
      const res = await fetch(`/api/crm/import/${openId}`);
      const json = (await res.json()) as {
        run?: PublicImportRunDetail;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível abrir a importação");
      return json.run!;
    },
  });

  if (!last) return null;

  const shown = lastDetail.data ?? last;
  const errors = lastDetail.data?.issues.filter((issue) => issue.status === "error") ?? [];
  const skipped =
    lastDetail.data?.issues.filter((issue) => issue.status === "skipped") ?? [];

  return (
    <div className="space-y-4">
      <GlassCard id="historico-importacao" className="space-y-3 p-6 hover:translate-y-0 md:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
            Histórico
          </p>
          <h3 className="mt-2 text-base font-semibold text-podium-white">
            {COPY.importacoesHistoryTitle}
          </h3>
          <p className="mt-1 text-[11px] text-podium-muted">
            {shown.file_name ? `${shown.file_name} · ` : ""}
            {new Date(shown.created_at).toLocaleString("pt-BR")}
            {shown.pipeline_nome ? ` · ${shown.pipeline_nome}` : ""}
          </p>
        </div>
        <RunBadges run={shown} />
        <RunLinks run={shown} />
        {lastDetail.isPending ? (
          <p className="text-sm text-podium-muted">Abrindo o detalhe…</p>
        ) : null}
        {lastDetail.data && errors.length > 0 ? (
          <ImportErrorFix key={lastDetail.data.id} run={lastDetail.data} />
        ) : null}
        {skipped.length > 0 ? (
          <div>
            <Hint>{COPY.importacoesSkippedHint}</Hint>
            <IssueList issues={skipped} status="skipped" />
          </div>
        ) : null}
      </GlassCard>

      {older.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-podium-muted">
            {COPY.importacoesHistoryOlder}
          </p>
          <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
            {older.map((run) => {
              const open = openId === run.id;
              const extra = open && olderDetail.data?.id === run.id ? olderDetail.data : null;
              const extraErrors =
                extra?.issues.filter((issue) => issue.status === "error") ?? [];
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col gap-1 px-3 py-2.5 text-left hover:bg-white/5",
                      open && "bg-white/[0.04]",
                    )}
                    onClick={() => setOpenId((current) => (current === run.id ? null : run.id))}
                  >
                    <span className="truncate text-sm text-podium-white">
                      {run.file_name || run.pipeline_nome}
                    </span>
                    <span className="text-[11px] text-podium-muted">
                      {new Date(run.created_at).toLocaleString("pt-BR")}
                    </span>
                    <RunBadges run={run} />
                  </button>
                  {extra ? (
                    <div className="border-t border-white/10 px-3 pb-3">
                      <RunLinks run={extra} />
                      {extraErrors.length > 0 ? (
                        <div className="mt-3">
                          <ImportErrorFix key={extra.id} run={extra} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
