"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { usePaywall } from "@/components/PaywallDialog";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { ImportHistory, IMPORT_RUNS_QUERY_KEY } from "@/components/importacoes/ImportHistory";
import { Button } from "@/components/ui/Button";
import { crmHref, gridHref } from "@/lib/back";
import { ENRICH_CREDIT_COST, creditsPhrase, planHasFeature } from "@/lib/billing/catalog";
import { isBillingGateError, throwIfBillingGate } from "@/lib/billing/paywall";
import { COPY } from "@/lib/copy";
import {
  guessImportMapping,
  mapImportLead,
  parseImportCnpj,
  pipelineNomeFromFile,
  type ImportColumnKey,
  type ImportLeadInput,
} from "@/lib/crm/import";
import { rowToRecord, type SpreadsheetTable } from "@/lib/crm/import-file";
import { IMPORT_MAX_ROWS } from "@/lib/crm/schema";
import type { CrmPipelineSummary } from "@/lib/crm/types";
import { useBillingMe } from "@/hooks/useBillingMe";
import { cn } from "@/lib/utils";

const NEW_PIPELINE = "__new__";

const INPUT =
  "w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 text-sm text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

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
    <label className="block text-sm text-podium-gray">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold text-podium-white">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-podium-yellow/40 text-[10px] font-bold text-podium-yellow">
          {n}
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
  const [qualify, setQualify] = useState(false);
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
  const readyCount = mappedPreview.filter((row) => row.ok).length;
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
    mutationFn: async () => {
      const res = await fetch("/api/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline_id: dest === NEW_PIPELINE ? undefined : dest,
          pipeline_nome:
            dest === NEW_PIPELINE ? pipelineNome.trim() || undefined : undefined,
          file_name: fileName ?? undefined,
          qualify,
          rows: mappedRows.slice(0, IMPORT_MAX_ROWS),
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
        <select
          className={cn(INPUT, "py-1.5 text-xs")}
          value={mapping[index] ?? "skip"}
          onChange={(event) => {
            const next = [...mapping];
            next[index] = event.target.value as ImportColumnKey;
            setMapping(next);
          }}
          aria-label={`Campo do Grid para ${header || `coluna ${index + 1}`}`}
        >
          {COLUMN_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const canImport =
    Boolean(table) &&
    readyCount > 0 &&
    (dest !== NEW_PIPELINE ? Boolean(dest) : Boolean(pipelineNome.trim()));

  return (
    <div className="mt-6 space-y-6">
      <ImportHistory />
      <GlassCard className="space-y-6 p-6 hover:translate-y-0 md:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
            Arquivo
          </p>
          <h3 className="mt-2 text-base font-semibold text-podium-white">
            Planilha
          </h3>
          <Hint className="mt-2">{COPY.importacoesFileHint}</Hint>
        </div>

        <Step n={1} title="Escolher o arquivo">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-4 py-7 text-center hover:border-podium-yellow/40">
            <Upload className="h-5 w-5 text-podium-yellow" />
            <span className="text-sm text-podium-gray">
              {fileName ? "Trocar CSV ou Excel" : "CSV ou Excel, até 500 linhas"}
            </span>
            {fileName ? (
              <span className="max-w-full truncate text-[11px] text-podium-muted">
                {fileName}
              </span>
            ) : null}
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

        <Step n={2} title="Casar as colunas">
          {table ? (
            <div className="space-y-3">
              <p className="text-xs text-podium-muted">
                {`${table.rows.length} linha${table.rows.length === 1 ? "" : "s"}${table.truncated ? ` · corte em ${IMPORT_MAX_ROWS}` : ""}. O nome da coluna pode ser qualquer um — o Grid usa o que você escolher à direita.`}
              </p>
              <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
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
                    <div className="mt-2 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
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
              {readyCount > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-white/10">
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
              ) : (
                <p className="text-sm text-podium-alert">
                  Precisa de empresa, CNPJ ou um contato (nome, telefone ou
                  e-mail).
                </p>
              )}
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

        <Step n={3} title="Destino desta subida">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nicho">
              <select
                className={INPUT}
                value={dest}
                onChange={(event) => setDest(event.target.value)}
              >
                <option value={NEW_PIPELINE}>Novo nicho</option>
                {initialPipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.nome}
                  </option>
                ))}
              </select>
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

        <Step n={4} title={`Importar para ${destName}`}>
          <label className="flex items-start gap-3 rounded-xl border border-white/10 px-3 py-3 text-sm text-podium-gray">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={qualify}
              onChange={(event) => setQualify(event.target.checked)}
            />
            <span>
              <span className="font-medium text-podium-white">
                {COPY.crmQualifyNow}
              </span>
              <span className="mt-0.5 block text-[11px] text-podium-muted">
                {creditsPhrase(ENRICH_CREDIT_COST)} por CNPJ · só quem tiver
                CNPJ depois da busca na base
                {mappedCnpjs > 0 ? ` · ${mappedCnpjs} já na planilha` : ""}.
                Saldo: {creditsPhrase(credits)}.
              </span>
            </span>
          </label>
          <Button
            variant="primary"
            className="mt-3"
            disabled={importRows.isPending || !canImport}
            onClick={() => importRows.mutate()}
          >
            {importRows.isPending
              ? "Importando…"
              : table
                ? `Importar ${readyCount} ${readyCount === 1 ? "negócio" : "negócios"}`
                : "Escolha o arquivo antes"}
          </Button>
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
            <ul className="mt-2 space-y-1 text-[11px] text-podium-alert">
              {importRows.data!.errors!.slice(0, 8).map((err) => (
                <li key={`${err.row}-${err.message}`}>
                  Linha {err.row}: {err.message}
                </li>
              ))}
            </ul>
          ) : null}
        </Step>
      </GlassCard>

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
