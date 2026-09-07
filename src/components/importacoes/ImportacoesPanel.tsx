"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { usePaywall } from "@/components/PaywallDialog";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { ImportHistory, IMPORT_RUNS_QUERY_KEY } from "@/components/importacoes/ImportHistory";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { crmHref, gridHref } from "@/lib/back";
import { ENRICH_CREDIT_COST, creditsPhrase, planHasFeature } from "@/lib/billing/catalog";
import { isBillingGateError, throwIfBillingGate } from "@/lib/billing/paywall";
import { httpErrorMessage, readResponseJson } from "@/lib/api-json";
import { COPY } from "@/lib/copy";
import {
  guessImportMapping,
  hydrateImportRow,
  importRowsForSubmit,
  mapImportLead,
  parseImportCnpj,
  pipelineNomeFromFile,
  withoutInvalidCnpj,
  type ImportColumnKey,
  type ImportLeadInput,
} from "@/lib/crm/import";
import { type SpreadsheetTable } from "@/lib/crm/import-file";
import { joinPt } from "@/lib/crm/import-issues";
import { IMPORT_EMPTY_ROW_MESSAGE } from "@/lib/crm/import-issues";
import { IMPORT_MAX_ROWS } from "@/lib/crm/schema";
import type { CrmPipelineSummary } from "@/lib/crm/types";
import { useBillingMe } from "@/hooks/useBillingMe";
import { cn } from "@/lib/utils";
import {
  workSplitClass,
  workSplitPaneClass,
  workSplitRailClass,
} from "@/lib/work-split";

const NEW_PIPELINE = "__new__";

const INPUT =
  "w-full rounded-md border border-white/10 bg-podium-panel px-2.5 py-1.5 text-xs text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

const COLUMN_OPTIONS: Array<{ id: ImportColumnKey; label: string }> = [
  { id: "skip", label: "Ignorar" },
  { id: "company", label: "Empresa" },
  { id: "name", label: "Nome" },
  { id: "phone", label: "Telefone" },
  { id: "email", label: "E-mail" },
  { id: "cnpj", label: "CNPJ" },
  { id: "people", label: "Sócios" },
  { id: "website", label: "Site" },
  { id: "instagram", label: "Instagram" },
  { id: "address", label: "Endereço" },
  { id: "notes", label: "Notas" },
];

const GRID_FIELDS = COLUMN_OPTIONS.filter((option) => option.id !== "skip");

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs text-podium-gray">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function StepStrip({
  items,
}: {
  items: Array<{
    n: number;
    title: string;
    status: "todo" | "current" | "done";
  }>;
}) {
  return (
    <ol className="flex gap-1">
      {items.map((item) => (
        <li
          key={item.n}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px]",
            item.status === "done" && "bg-podium-yellow/10 text-podium-white",
            item.status === "current" && "bg-white/[0.06] text-podium-white",
            item.status === "todo" && "text-podium-muted",
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
              item.status === "done" && "bg-podium-yellow text-podium-navy",
              item.status === "current" &&
                "border border-podium-yellow/70 text-podium-yellow",
              item.status === "todo" && "border border-white/15",
            )}
          >
            {item.status === "done" ? (
              <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
            ) : (
              item.n
            )}
          </span>
          <span className="truncate">{item.title}</span>
        </li>
      ))}
    </ol>
  );
}

function sampleCell(table: SpreadsheetTable, index: number): string {
  for (const row of table.rows) {
    const value = (row[index] ?? "").trim();
    if (value) return value;
  }
  return "";
}

export function ImportacoesPanel({
  initialPipelines,
}: {
  initialPipelines: CrmPipelineSummary[];
}) {
  const { openPaywall } = usePaywall();
  const billing = useBillingMe();
  const queryClient = useQueryClient();
  const [dest, setDest] = useState(NEW_PIPELINE);
  const [pipelineNome, setPipelineNome] = useState("");
  const [table, setTable] = useState<SpreadsheetTable | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ImportColumnKey[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const parseFile = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/crm/import/parse", {
        method: "POST",
        body,
      });
      const json = await readResponseJson<SpreadsheetTable & { error?: string }>(
        res,
      );
      if (!res.ok) {
        throw new Error(
          httpErrorMessage(res.status, json, "Não foi possível ler o arquivo"),
        );
      }
      if (!json) throw new Error("Não foi possível ler o arquivo");
      return { table: json, name: file.name };
    },
    onSuccess: ({ table: data, name }) => {
      setFileError(null);
      setFileName(name);
      setTable(data);
      setMapping(guessImportMapping(data.headers, data.rows));
      setPipelineNome((current) => current.trim() || pipelineNomeFromFile(name));
      setShowSkipped(false);
      importRows.reset();
    },
    onError: (err: Error) => setFileError(err.message),
  });

  const mappedRows = useMemo((): ImportLeadInput[] => {
    if (!table) return [];
    return table.rows.map((row) => hydrateImportRow(table.headers, row, mapping));
  }, [mapping, table]);

  const mappedPreview = useMemo(
    () => mappedRows.map((row) => mapImportLead(row)),
    [mappedRows],
  );
  const anywayPreview = useMemo(
    () => mappedRows.map((row) => mapImportLead(withoutInvalidCnpj(row))),
    [mappedRows],
  );
  const readyCount = mappedPreview.filter((row) => row.ok).length;
  const anywayCount = anywayPreview.filter((row) => row.ok).length;
  const emptyCount = mappedPreview.filter(
    (row) => !row.ok && row.message === IMPORT_EMPTY_ROW_MESSAGE,
  ).length;
  const problemRows = useMemo(
    () =>
      mappedPreview
        .map((result, index) => ({ result, index, input: mappedRows[index]! }))
        .filter(
          (item) =>
            !item.result.ok && item.result.message !== IMPORT_EMPTY_ROW_MESSAGE,
        ),
    [mappedPreview, mappedRows],
  );
  const mappedCnpjs = useMemo(() => {
    const found = new Set<string>();
    for (const row of mappedRows) {
      const { cnpj } = parseImportCnpj(row.cnpj);
      if (cnpj) found.add(cnpj);
    }
    return found.size;
  }, [mappedRows]);
  const droppedCnpjCount = useMemo(() => {
    return mappedRows.filter((row, index) => {
      const raw = (row.cnpj ?? "").replace(/\D/g, "");
      if (!raw) return false;
      const mapped = mappedPreview[index];
      return Boolean(mapped?.ok && !mapped.lead.cnpj);
    }).length;
  }, [mappedPreview, mappedRows]);
  const extrasBits = useMemo(() => {
    const labels: string[] = [];
    if (
      mappedPreview.some(
        (row) =>
          row.ok &&
          row.lead.people.filter((person) => person.name.trim()).length > 0 &&
          mapping.includes("people"),
      )
    ) {
      labels.push("sócios");
    }
    if (mappedPreview.some((row) => row.ok && row.lead.notes.includes("Site:"))) {
      labels.push("site");
    }
    if (
      mappedPreview.some((row) => row.ok && row.lead.notes.includes("Instagram:"))
    ) {
      labels.push("Instagram");
    }
    if (
      mappedPreview.some((row) => row.ok && row.lead.notes.includes("Endereço:"))
    ) {
      labels.push("endereço");
    }
    return labels;
  }, [mappedPreview, mapping]);
  const notesMapped = mapping.some((key) => key === "notes");
  const mappedIndexes = mapping
    .map((key, index) => ({ key, index }))
    .filter((row) => row.key !== "skip");
  const skippedIndexes = mapping
    .map((key, index) => ({ key, index }))
    .filter((row) => row.key === "skip");
  const credits = billing.data?.balance.total ?? 0;

  const importRows = useMutation({
    mutationFn: async (opts: {
      mode: "ready" | "anyway";
      qualify: boolean;
    }) => {
      const rows = importRowsForSubmit(mappedRows, opts.mode, IMPORT_MAX_ROWS);
      const res = await fetch("/api/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline_id: dest === NEW_PIPELINE ? undefined : dest,
          pipeline_nome:
            dest === NEW_PIPELINE ? pipelineNome.trim() || undefined : undefined,
          file_name: fileName ?? undefined,
          qualify: opts.qualify,
          rows,
        }),
      });
      const json = await readResponseJson<{
        created?: number;
        skipped?: number;
        errors?: Array<{ row: number; message: string }>;
        pipeline_id?: string;
        matched_cnpjs?: number;
        list_id?: string | null;
        qualified?: number;
        error?: string;
      }>(res);
      throwIfBillingGate(res.status, json ?? {}, openPaywall, "qualify");
      if (!res.ok) {
        throw new Error(
          httpErrorMessage(
            res.status,
            json,
            "Não foi possível importar",
            COPY.importacoesTimeout,
          ),
        );
      }
      if (!json) throw new Error("Não foi possível importar");
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: IMPORT_RUNS_QUERY_KEY });
    },
  });

  function pickFile(file: File | undefined) {
    if (!file) return;
    parseFile.mutate(file);
  }

  function columnRow(index: number) {
    if (!table) return null;
    const header = table.headers[index] ?? `Coluna ${index + 1}`;
    const sample = sampleCell(table, index);
    return (
      <div
        key={`${header}-${index}`}
        className="grid gap-2 px-2.5 py-2 sm:grid-cols-[1fr_148px] sm:items-center"
      >
        <div className="min-w-0">
          <p className="truncate text-sm text-podium-white">
            {header || `Coluna ${index + 1}`}
          </p>
          {sample ? (
            <p className="truncate text-[11px] text-podium-muted">{sample}</p>
          ) : (
            <p className="text-[11px] text-podium-muted">
              Sem valor nas primeiras linhas
            </p>
          )}
        </div>
        <Select
          size="sm"
          className="w-full"
          value={mapping[index] ?? "skip"}
          onChange={(value) => {
            const next = [...mapping];
            next[index] = value as ImportColumnKey;
            setMapping(next);
          }}
          aria-label={`Campo do Grid para ${header || `coluna ${index + 1}`}`}
          options={COLUMN_OPTIONS.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
        />
      </div>
    );
  }

  const destReady =
    dest !== NEW_PIPELINE ? Boolean(dest) : Boolean(pipelineNome.trim());
  const canImport = Boolean(table) && readyCount > 0 && destReady;
  const canImportAnyway = Boolean(table) && anywayCount > readyCount && destReady;
  const blockReason = !table
    ? COPY.importacoesNeedFile
    : readyCount === 0
      ? COPY.importacoesNeedRows
      : !destReady
        ? dest === NEW_PIPELINE
          ? COPY.importacoesNeedNicheName
          : COPY.importacoesNeedNiche
        : null;
  const lineSummary = table
    ? `${table.rows.length} linha${table.rows.length === 1 ? "" : "s"}${
        table.truncated ? ` · corte em ${IMPORT_MAX_ROWS}` : ""
      } · ${readyCount} pronta${readyCount === 1 ? "" : "s"}`
    : "";
  const salvageHints = [
    table && table.foldedLines > 0
      ? table.foldedLines === 1
        ? COPY.importacoesFoldedLinesOne
        : COPY.importacoesFoldedLinesMany.replace("{n}", String(table.foldedLines))
      : null,
    droppedCnpjCount > 0
      ? droppedCnpjCount === 1
        ? COPY.importacoesCnpjDroppedOne
        : COPY.importacoesCnpjDroppedMany.replace("{n}", String(droppedCnpjCount))
      : null,
    extrasBits.length > 0
      ? COPY.importacoesExtrasUsed.replace("{bits}", joinPt(extrasBits))
      : null,
  ].filter(Boolean) as string[];
  const step1: "todo" | "current" | "done" = table ? "done" : "current";
  const step2: "todo" | "current" | "done" = table
    ? readyCount > 0
      ? "done"
      : "current"
    : "todo";
  const step3: "todo" | "current" | "done" = table
    ? destReady
      ? "done"
      : "current"
    : "todo";
  const step4: "todo" | "current" | "done" = importRows.data
    ? "done"
    : table
      ? "current"
      : "todo";

  return (
    <div className={workSplitClass}>
      <div className={cn(workSplitRailClass, "space-y-3 lg:w-[28rem]")}>
        <GlassCard className="space-y-3 p-3 hover:translate-y-0">
          <StepStrip
            items={[
              { n: 1, title: "Arquivo", status: step1 },
              { n: 2, title: "Campos", status: step2 },
              { n: 3, title: "Destino", status: step3 },
              { n: 4, title: "Importar", status: step4 },
            ]}
          />
          <Hint>{COPY.importacoesFileHint}</Hint>

          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md px-3 py-3 text-center transition",
              table
                ? "border border-podium-yellow/50 bg-podium-yellow/10 hover:border-podium-yellow/70"
                : "border border-dashed border-white/15 hover:border-podium-yellow/40",
            )}
          >
            {table ? (
              <Check className="h-4 w-4 text-podium-yellow" strokeWidth={2.5} />
            ) : (
              <Upload className="h-4 w-4 text-podium-yellow" />
            )}
            {table && fileName ? (
              <>
                <span className="max-w-full truncate text-sm font-semibold text-podium-white">
                  {fileName}
                </span>
                <span className="text-[11px] text-podium-gray">{lineSummary}</span>
                <span className="text-[11px] font-medium text-podium-yellow">
                  {COPY.importacoesChangeFile}
                </span>
              </>
            ) : (
              <span className="text-sm text-podium-gray">
                {COPY.importacoesChooseFile}
              </span>
            )}
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                pickFile(file);
              }}
            />
          </label>
          {parseFile.isPending ? (
            <p className="text-sm text-podium-muted">Lendo a planilha…</p>
          ) : null}
          {fileError ? (
            <p className="text-sm text-podium-alert">{fileError}</p>
          ) : null}

          {table ? (
            <div className="space-y-2">
              <p className="text-[11px] text-podium-muted">
                O nome da coluna pode ser qualquer um — o Grid usa o que você
                escolher à direita.
              </p>
              <div className="divide-y divide-white/10 overflow-hidden rounded-md border border-white/10">
                {mappedIndexes.map((row) => columnRow(row.index))}
              </div>
              {skippedIndexes.length > 0 ? (
                <div>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-podium-yellow underline-offset-2 hover:underline"
                    onClick={() => setShowSkipped((open) => !open)}
                  >
                    {showSkipped
                      ? "Ocultar o resto"
                      : `Mostrar o resto (${skippedIndexes.length})`}
                  </button>
                  {showSkipped ? (
                    <div className="mt-2 divide-y divide-white/10 overflow-hidden rounded-md border border-white/10">
                      {skippedIndexes.map((row) => columnRow(row.index))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {notesMapped ? (
                <p className="text-[11px] text-podium-muted">
                  Anotações entram nas notas do cartão. Duas colunas de
                  observação viram uma nota só.
                </p>
              ) : (
                <p className="text-[11px] text-podium-muted">
                  Tem observação, histórico ou comentário? Aponte para Notas.
                </p>
              )}
            </div>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {GRID_FIELDS.map((field) => (
                <li
                  key={field.id}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-podium-gray"
                >
                  {field.label}
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nicho">
              <Select
                value={dest}
                onChange={setDest}
                className="w-full"
                options={[
                  { value: NEW_PIPELINE, label: "Novo nicho" },
                  ...initialPipelines.map((pipeline) => ({
                    value: pipeline.id,
                    label: pipeline.nome,
                  })),
                ]}
              />
            </Field>
            {dest === NEW_PIPELINE ? (
              <Field label="Nome do nicho">
                <input
                  className={INPUT}
                  value={pipelineNome}
                  maxLength={80}
                  placeholder="Nome do arquivo"
                  onChange={(event) => setPipelineNome(event.target.value)}
                />
              </Field>
            ) : (
              <p className="self-end text-[11px] text-podium-muted">
                Os cartões entram em Entrada de Lista.
              </p>
            )}
          </div>
          {dest === NEW_PIPELINE ? (
            <p className="text-[11px] text-podium-muted">
              Os cartões entram em Entrada de Lista. Você muda a etapa no quadro
              depois.
            </p>
          ) : null}

          <div className="space-y-2">
            <Button
              variant="primary"
              size="lg"
              className="h-11 w-full px-5 text-sm font-semibold"
              disabled={importRows.isPending || !canImport}
              onClick={() => importRows.mutate({ mode: "ready", qualify: false })}
            >
              {importRows.isPending
                ? "Importando…"
                : table
                  ? `Importar ${readyCount} ${readyCount === 1 ? "negócio" : "negócios"}`
                  : COPY.importacoesNeedFile}
            </Button>
            {anywayCount > readyCount ? (
              <Button
                variant="secondary"
                className="w-full"
                disabled={importRows.isPending || !canImportAnyway}
                onClick={() =>
                  importRows.mutate({ mode: "anyway", qualify: false })
                }
              >
                {COPY.importacoesSendAnyway}
              </Button>
            ) : null}
          </div>
          {anywayCount > readyCount ? (
            <Hint>{COPY.importacoesSendAnywayHint}</Hint>
          ) : null}
          {canImport ? (
            <div className="rounded-md border border-white/10 px-3 py-3">
              <p className="text-sm font-medium text-podium-white">
                {COPY.importacoesImportAndQualify}
              </p>
              <p className="mt-0.5 text-[11px] text-podium-muted">
                {creditsPhrase(ENRICH_CREDIT_COST)} por CNPJ · só quem já tiver
                CNPJ na planilha
                {mappedCnpjs > 0 ? ` · ${mappedCnpjs} na planilha` : ""}.
                Saldo: {creditsPhrase(credits)}.
              </p>
              <Button
                variant="secondary"
                className="mt-2"
                disabled={importRows.isPending}
                onClick={() =>
                  importRows.mutate({ mode: "ready", qualify: true })
                }
              >
                {COPY.importacoesImportAndQualify}
              </Button>
            </div>
          ) : null}
          {blockReason &&
          blockReason !== COPY.importacoesNeedFile &&
          !importRows.isPending ? (
            <p className="text-[11px] text-podium-muted">{blockReason}</p>
          ) : null}
          {importRows.isError && !isBillingGateError(importRows.error) ? (
            <p className="text-sm text-podium-alert">
              {(importRows.error as Error).message}
            </p>
          ) : null}
          {importRows.data ? (
            <p className="text-sm text-podium-gray">
              {`${importRows.data.created ?? 0} no CRM${
                importRows.data.matched_cnpjs
                  ? ` · ${importRows.data.matched_cnpjs} na lista (com CNPJ)`
                  : ""
              }${importRows.data.qualified ? ` · ${importRows.data.qualified} na fila de qualificar` : ""}${(importRows.data.errors?.length ?? 0) > 0 ? ` · ${importRows.data.errors?.length} com erro` : ""}. `}
              {importRows.data.pipeline_id ? (
                <Link
                  href={crmHref({ pipeline: importRows.data.pipeline_id })}
                  className="font-semibold text-podium-yellow"
                >
                  Abrir o quadro
                </Link>
              ) : null}
              {importRows.data.list_id ? (
                <>
                  {" · "}
                  <Link
                    href={gridHref(importRows.data.list_id, "listas")}
                    className="font-semibold text-podium-yellow"
                  >
                    Abrir a lista
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          {(importRows.data?.errors?.length ?? 0) > 0 ? (
            <Hint>
              <a
                href="#historico-importacao"
                className="font-semibold text-podium-yellow"
              >
                {importRows.data!.errors!.length === 1
                  ? COPY.importacoesPanelFixPointerOne
                  : COPY.importacoesPanelFixPointerMany.replace(
                      "{n}",
                      String(importRows.data!.errors!.length),
                    )}
              </a>
            </Hint>
          ) : null}
        </GlassCard>
      </div>

      <div className={cn(workSplitPaneClass, "space-y-3")}>
        <GlassCard className="space-y-3 p-3 hover:translate-y-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
            Preview
          </p>
          {table ? (
            <div className="space-y-3">
              <p className="text-xs text-podium-muted">{`${lineSummary}.`}</p>
              {salvageHints.map((hint) => (
                <p key={hint} className="text-[11px] text-podium-muted">
                  {hint}
                </p>
              ))}
              {emptyCount > 0 ? (
                <p className="text-[11px] text-podium-muted">
                  {emptyCount === 1
                    ? COPY.importacoesEmptySkippedOne
                    : COPY.importacoesEmptySkippedMany.replace(
                        "{n}",
                        String(emptyCount),
                      )}
                </p>
              ) : null}
              {problemRows.length > 0 ? (
                <div className="rounded-md border border-white/10 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                    {COPY.importacoesProblemPreview}
                  </p>
                  <ul className="mt-2 space-y-1 text-[11px] text-podium-muted">
                    {problemRows.slice(0, 8).map((item) => {
                      const who = [item.input.company, item.input.name]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <li key={item.index}>
                          Linha {item.index + 1}:{" "}
                          {item.result.ok ? "" : item.result.message}
                          {who ? ` · ${who}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                  {problemRows.length > 8 ? (
                    <p className="mt-1 text-[11px] text-podium-muted">
                      {`e mais ${problemRows.length - 8}`}
                    </p>
                  ) : null}
                </div>
              ) : readyCount === 0 ? (
                <p className="text-sm text-podium-alert">
                  Precisa de empresa, CNPJ ou um contato (nome, telefone ou
                  e-mail).
                </p>
              ) : null}
              {readyCount > 0 ? (
                <div className="overflow-x-auto rounded-md border border-white/10">
                  <table className="min-w-full text-left text-[11px] text-podium-muted">
                    <thead>
                      <tr>
                        <th className="px-3 py-1.5 font-medium">Empresa</th>
                        <th className="px-3 py-1.5 font-medium">Contato</th>
                        <th className="px-3 py-1.5 font-medium">Telefone</th>
                        <th className="px-3 py-1.5 font-medium">CNPJ</th>
                        <th className="px-3 py-1.5 font-medium">Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappedPreview.slice(0, 12).map((row, index) => (
                        <tr key={index} className="border-t border-white/10">
                          <td className="max-w-[160px] truncate px-3 py-1.5 text-podium-white">
                            {row.ok ? row.lead.company_name : "—"}
                          </td>
                          <td className="max-w-[140px] truncate px-3 py-1.5">
                            {row.ok ? row.lead.contact_name || "—" : "—"}
                          </td>
                          <td className="max-w-[120px] truncate px-3 py-1.5">
                            {row.ok ? row.lead.phones[0] || "—" : "—"}
                          </td>
                          <td className="max-w-[120px] truncate px-3 py-1.5">
                            {row.ok ? row.lead.cnpj || "a achar" : "—"}
                          </td>
                          <td className="max-w-[180px] truncate px-3 py-1.5">
                            {row.ok ? row.lead.notes || "—" : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-podium-muted">
              Escolha o arquivo à esquerda para ver as linhas.
            </p>
          )}
        </GlassCard>

        <ImportHistory />

        {planHasFeature(billing.data?.balance.plano, "automations") ? (
          <p className="text-sm text-podium-muted">
            Formulário, anúncio ou Make?{" "}
            <Link href="/automacoes" className="font-semibold text-podium-yellow">
              Abrir Automações
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
