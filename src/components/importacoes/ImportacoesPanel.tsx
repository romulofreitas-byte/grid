"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Upload } from "lucide-react";
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
import { COPY } from "@/lib/copy";
import {
  guessImportMapping,
  importRowsForSubmit,
  mapImportLead,
  parseImportCnpj,
  pipelineNomeFromFile,
  withoutInvalidCnpj,
  type ImportColumnKey,
  type ImportLeadInput,
} from "@/lib/crm/import";
import { rowToRecord, type SpreadsheetTable } from "@/lib/crm/import-file";
import { IMPORT_EMPTY_ROW_MESSAGE } from "@/lib/crm/import-issues";
import { IMPORT_MAX_ROWS } from "@/lib/crm/schema";
import type { CrmPipelineSummary } from "@/lib/crm/types";
import { useBillingMe } from "@/hooks/useBillingMe";
import { cn } from "@/lib/utils";

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

function Step({
  n,
  title,
  status,
  children,
}: {
  n: number;
  title: string;
  status: "todo" | "current" | "done";
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold text-podium-white">
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
            status === "done" && "bg-podium-yellow text-podium-navy",
            status === "current" &&
              "border border-podium-yellow/70 bg-podium-yellow/15 text-podium-yellow",
            status === "todo" && "border border-white/15 text-podium-muted",
          )}
        >
          {status === "done" ? (
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          ) : (
            n
          )}
        </span>
        {title}
      </p>
      <div className="pl-7">{children}</div>
    </div>
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
      const json = (await res.json()) as SpreadsheetTable & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível ler o arquivo");
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
    return table.rows.map((row) =>
      rowToRecord(table.headers, row, mapping) as ImportLeadInput,
    );
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
  const notesMapped = mapping.some((key) => key === "notes");
  const mappedIndexes = mapping
    .map((key, index) => ({ key, index }))
    .filter((row) => row.key !== "skip");
  const skippedIndexes = mapping
    .map((key, index) => ({ key, index }))
    .filter((row) => row.key === "skip");
  const destName =
    dest === NEW_PIPELINE
      ? pipelineNome.trim() || "nicho novo"
      : initialPipelines.find((pipeline) => pipeline.id === dest)?.nome ??
        "nicho";
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
      const json = (await res.json()) as {
        created?: number;
        skipped?: number;
        errors?: Array<{ row: number; message: string }>;
        pipeline_id?: string;
        matched_cnpjs?: number;
        list_id?: string | null;
        qualified?: number;
        error?: string;
      };
      throwIfBillingGate(res.status, json, openPaywall, "qualify");
      if (!res.ok) throw new Error(json.error ?? "Não foi possível importar");
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
        className="grid gap-2 p-3 sm:grid-cols-[1fr_148px] sm:items-center"
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
    <div className="mt-6 space-y-6">
      <GlassCard className="space-y-4 p-3 hover:translate-y-0">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
            Arquivo
          </p>
          <h3 className="mt-1 text-sm font-semibold text-podium-white">
            Planilha
          </h3>
          <Hint className="mt-2">{COPY.importacoesFileHint}</Hint>
        </div>

        {table && fileName ? (
          <p className="rounded-md border border-podium-yellow/25 bg-podium-yellow/10 px-3 py-2 text-xs text-podium-white">
            <span className="font-medium">{fileName}</span>
            <span className="text-podium-muted">
              {` · ${readyCount} pronta${readyCount === 1 ? "" : "s"} · ${destName}`}
            </span>
          </p>
        ) : null}

        <Step n={1} title="Escolher o arquivo" status={step1}>
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md px-3 py-4 text-center transition",
              table
                ? "border border-podium-yellow/50 bg-podium-yellow/10 hover:border-podium-yellow/70"
                : "border border-dashed border-white/15 hover:border-podium-yellow/40",
            )}
          >
            {table ? (
              <Check className="h-5 w-5 text-podium-yellow" strokeWidth={2.5} />
            ) : (
              <Upload className="h-5 w-5 text-podium-yellow" />
            )}
            {table && fileName ? (
              <>
                <span className="max-w-full truncate text-sm font-semibold text-podium-white">
                  {fileName}
                </span>
                <span className="text-xs text-podium-gray">{lineSummary}</span>
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
            <p className="mt-2 text-sm text-podium-muted">Lendo a planilha…</p>
          ) : null}
          {fileError ? (
            <p className="mt-2 text-sm text-podium-alert">{fileError}</p>
          ) : null}
        </Step>

        <Step n={2} title="O que entra" status={step2}>
          {table ? (
            <div className="space-y-3">
              <p className="text-xs text-podium-muted">{`${lineSummary}.`}</p>
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
                    {problemRows.slice(0, 6).map((item) => {
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
                  {problemRows.length > 6 ? (
                    <p className="mt-1 text-[11px] text-podium-muted">
                      {`e mais ${problemRows.length - 6}`}
                    </p>
                  ) : null}
                </div>
              ) : readyCount === 0 ? (
                <p className="text-sm text-podium-alert">
                  Precisa de empresa, CNPJ ou um contato (nome, telefone ou
                  e-mail).
                </p>
              ) : null}
              <details className="group rounded-md border border-white/10 bg-white/[0.04] open:border-podium-yellow/25">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-podium-white [&::-webkit-details-marker]:hidden">
                  <span>{COPY.importacoesMoreOptions}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-podium-muted transition group-open:rotate-180 group-open:text-podium-yellow" />
                </summary>
                <div className="space-y-3 px-4 pb-4">
                  <p className="text-xs text-podium-muted">
                    O nome da coluna pode ser qualquer um — o Grid usa o que
                    você escolher à direita.
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
                      Tem observação, histórico ou comentário? Aponte para
                      Notas.
                    </p>
                  )}
                  {readyCount > 0 ? (
                    <div className="overflow-x-auto rounded-md border border-white/10">
                      <p className="px-3 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                        Como entra no Grid
                      </p>
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
                          {mappedPreview.slice(0, 4).map((row, index) => (
                            <tr key={index} className="border-t border-white/10">
                              <td className="max-w-[140px] truncate px-3 py-1.5">
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
              </details>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-podium-muted">
                Depois do arquivo, cada coluna da planilha aponta para um
                destes campos:
              </p>
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
            </div>
          )}
        </Step>

        <Step n={3} title="Destino desta subida" status={step3}>
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
            <p className="mt-2 text-[11px] text-podium-muted">
              Os cartões entram em Entrada de Lista. Você muda a etapa no quadro
              depois.
            </p>
          ) : null}
        </Step>

        <Step n={4} title={`Importar para ${destName}`} status={step4}>
          <div className="space-y-2">
            <Button
              variant="primary"
              size="lg"
              className="h-11 w-full px-5 text-sm font-semibold sm:w-auto"
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
            <Hint className="mt-2">{COPY.importacoesSendAnywayHint}</Hint>
          ) : null}
          {canImport ? (
            <div className="mt-3 rounded-md border border-white/10 px-3 py-3">
              <p className="text-sm font-medium text-podium-white">
                {COPY.importacoesImportAndQualify}
              </p>
              <p className="mt-0.5 text-[11px] text-podium-muted">
                {creditsPhrase(ENRICH_CREDIT_COST)} por CNPJ · só quem tiver
                CNPJ depois da busca na base
                {mappedCnpjs > 0 ? ` · ${mappedCnpjs} já na planilha` : ""}.
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
            <p className="mt-2 text-[11px] text-podium-muted">{blockReason}</p>
          ) : null}
          {importRows.isError && !isBillingGateError(importRows.error) ? (
            <p className="mt-2 text-sm text-podium-alert">
              {(importRows.error as Error).message}
            </p>
          ) : null}
          {importRows.data ? (
            <p className="mt-2 text-sm text-podium-gray">
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
            <Hint className="mt-2">
              <a href="#historico-importacao" className="font-semibold text-podium-yellow">
                {(importRows.data!.errors!.length === 1
                  ? COPY.importacoesPanelFixPointerOne
                  : COPY.importacoesPanelFixPointerMany.replace(
                      "{n}",
                      String(importRows.data!.errors!.length),
                    ))}
              </a>
            </Hint>
          ) : null}
        </Step>
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
  );
}
