"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/Button";
import { crmHref } from "@/lib/back";
import { COPY } from "@/lib/copy";
import {
  guessImportMapping,
  mapImportLead,
  type ImportColumnKey,
  type ImportLeadInput,
} from "@/lib/crm/import";
import { rowToRecord, type SpreadsheetTable } from "@/lib/crm/import-file";
import { IMPORT_MAX_ROWS } from "@/lib/crm/schema";
import type { CrmBoard, CrmPipelineSummary } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

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

const SAMPLE_PAYLOAD = {
  company: "Padaria do João",
  name: "Maria Silva",
  phone: "11981887766",
  email: "maria@exemplo.com",
  cnpj: "00000000000191",
  notes: "Meta Lead Ads",
};

type InboundResponse = {
  endpoint: {
    id: string;
    pipeline_id: string;
    stage_id: string | null;
  } | null;
  token?: string | null;
  url: string;
};

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

function CopyField({
  value,
  ariaLabel,
}: {
  value: string;
  ariaLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <p className="min-w-0 flex-1 break-all font-mono text-[11px] text-podium-gray">
        {value}
      </p>
      <button
        type="button"
        aria-label={copied ? "Copiado" : ariaLabel}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-podium-muted hover:bg-white/5 hover:text-podium-white"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
        }}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-podium-yellow" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function DestinationSelects({
  pipelines,
  stages,
  pipelineId,
  stageId,
  onPipeline,
  onStage,
}: {
  pipelines: CrmPipelineSummary[];
  stages: Array<{ id: string; nome: string }>;
  pipelineId: string;
  stageId: string;
  onPipeline: (id: string) => void;
  onStage: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nicho">
        <select
          className={INPUT}
          value={pipelineId}
          onChange={(e) => onPipeline(e.target.value)}
        >
          {pipelines.map((pipeline) => (
            <option key={pipeline.id} value={pipeline.id}>
              {pipeline.nome}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Etapa">
        <select
          className={INPUT}
          value={stageId}
          onChange={(e) => onStage(e.target.value)}
        >
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.nome}
            </option>
          ))}
        </select>
      </Field>
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
  initialBoard,
}: {
  initialPipelines: CrmPipelineSummary[];
  initialBoard: CrmBoard | null;
}) {
  const qc = useQueryClient();
  const [pipelineId, setPipelineId] = useState(
    initialBoard?.pipeline.id ?? initialPipelines[0]?.id ?? "",
  );
  const [stageId, setStageId] = useState(initialBoard?.stages[0]?.id ?? "");
  const [table, setTable] = useState<SpreadsheetTable | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ImportColumnKey[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [plainToken, setPlainToken] = useState<string | null>(null);
  const [showSample, setShowSample] = useState(false);

  const boardQuery = useQuery({
    queryKey: ["crm-board", pipelineId],
    enabled: Boolean(pipelineId),
    queryFn: async () => {
      const res = await fetch(`/api/crm/pipelines/${pipelineId}`);
      if (!res.ok) throw new Error("Não foi possível carregar o nicho");
      return (await res.json()) as { board: CrmBoard };
    },
    initialData:
      initialBoard && pipelineId === initialBoard.pipeline.id
        ? { board: initialBoard }
        : undefined,
  });

  const inboundQuery = useQuery({
    queryKey: ["crm-inbound"],
    queryFn: async () => {
      const res = await fetch("/api/crm/inbound");
      if (!res.ok) throw new Error("Não foi possível carregar a integração");
      return (await res.json()) as InboundResponse;
    },
  });

  const stages = boardQuery.data?.board.stages ?? initialBoard?.stages ?? [];
  const resolvedStageId =
    stages.some((stage) => stage.id === stageId) ? stageId : stages[0]?.id ?? "";
  const pipelineName =
    initialPipelines.find((pipeline) => pipeline.id === pipelineId)?.nome ??
    "nicho";
  const stageName =
    stages.find((stage) => stage.id === resolvedStageId)?.nome ?? "etapa";

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
      setMapping(guessImportMapping(data.headers));
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
  const notesMapped = mapping.some((key) => key === "notes");

  const importRows = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline_id: pipelineId,
          stage_id: resolvedStageId || undefined,
          rows: mappedRows.slice(0, IMPORT_MAX_ROWS),
        }),
      });
      const json = (await res.json()) as {
        created?: number;
        skipped?: number;
        errors?: Array<{ row: number; message: string }>;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível importar");
      return json;
    },
  });

  const saveInbound = useMutation({
    mutationFn: async (rotate: boolean) => {
      const res = await fetch("/api/crm/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline_id: pipelineId,
          stage_id: resolvedStageId || null,
          rotate,
        }),
      });
      const json = (await res.json()) as InboundResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível salvar");
      return json;
    },
    onSuccess: (data) => {
      if (data.token) {
        setPlainToken(data.token);
      }
      void qc.invalidateQueries({ queryKey: ["crm-inbound"] });
    },
  });

  const inboundUrl = inboundQuery.data?.url ?? "";
  const inboundEndpoint = inboundQuery.data?.endpoint ?? null;
  const destinationDirty =
    Boolean(inboundEndpoint) &&
    (inboundEndpoint?.pipeline_id !== pipelineId ||
      (inboundEndpoint?.stage_id ?? "") !== (resolvedStageId || ""));
  const sampleJson = JSON.stringify(SAMPLE_PAYLOAD, null, 2);

  function onPipeline(id: string) {
    setPipelineId(id);
    setStageId("");
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    parseFile.mutate(file);
  }

  return (
    <div className="mt-6 space-y-6">
      <GlassCard className="p-5 hover:translate-y-0 md:p-6">
        <p className="text-sm font-semibold text-podium-white">
          Onde entram no quadro
        </p>
        <Hint className="mt-1">
          Arquivo e integração usam o mesmo nicho e a mesma etapa.
        </Hint>
        <div className="mt-3">
          <DestinationSelects
            pipelines={initialPipelines}
            stages={stages}
            pipelineId={pipelineId}
            stageId={resolvedStageId}
            onPipeline={onPipeline}
            onStage={setStageId}
          />
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-2">
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
                  {table.headers.map((header, index) => {
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
                            <p className="truncate text-[11px] text-podium-muted">
                              {sample}
                            </p>
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
                  })}
                </div>
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

          <Step n={3} title={`Importar para ${pipelineName}`}>
            <Button
              variant="primary"
              disabled={
                importRows.isPending || !table || readyCount === 0 || !pipelineId
              }
              onClick={() => importRows.mutate()}
            >
              {importRows.isPending
                ? "Importando…"
                : table
                  ? `Importar ${readyCount} ${readyCount === 1 ? "negócio" : "negócios"}`
                  : "Escolha o arquivo antes"}
            </Button>
            {importRows.isError ? (
              <p className="mt-2 text-sm text-podium-alert">
                {(importRows.error as Error).message}
              </p>
            ) : null}
            {importRows.data ? (
              <p className="mt-2 text-sm text-podium-gray">
                {`${importRows.data.created ?? 0} criados · ${importRows.data.skipped ?? 0} já estavam no nicho${(importRows.data.errors?.length ?? 0) > 0 ? ` · ${importRows.data.errors?.length} com erro` : ""}. `}
                <Link
                  href={crmHref({ pipeline: pipelineId })}
                  className="font-semibold text-podium-yellow"
                >
                  Abrir o quadro
                </Link>
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

        <GlassCard className="space-y-6 p-6 hover:translate-y-0 md:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
              Integração
            </p>
            <h3 className="mt-2 text-base font-semibold text-podium-white">
              Formulário ou automação
            </h3>
            <Hint className="mt-2">{COPY.importacoesInboundHint}</Hint>
          </div>

          <Step n={1} title="Endereço">
            {inboundQuery.isLoading ? (
              <p className="text-xs text-podium-muted">Montando o endereço…</p>
            ) : inboundUrl ? (
              <>
                <CopyField value={inboundUrl} ariaLabel="Copiar endereço" />
                <p className="mt-1.5 text-[11px] text-podium-muted">
                  Cole no módulo HTTP do Make — POST, JSON.
                </p>
              </>
            ) : (
              <p className="text-xs text-podium-muted">
                Não foi possível montar o endereço.
              </p>
            )}
          </Step>

          <Step n={2} title="Chave">
            {plainToken ? (
              <div className="space-y-2">
                <p className="text-xs text-podium-gray">
                  Guarde agora. O Grid não mostra de novo.
                </p>
                <CopyField
                  value={`Bearer ${plainToken}`}
                  ariaLabel="Copiar valor do header"
                />
                <p className="text-[11px] text-podium-muted">
                  No Make: header Authorization, valor acima.
                </p>
              </div>
            ) : inboundEndpoint ? (
              <p className="text-xs text-podium-muted">
                Já existe uma chave nesta conta. No Make: header Authorization,
                valor Bearer + a chave.
              </p>
            ) : (
              <p className="text-xs text-podium-muted">
                A chave autentica o POST. Sem ela, o endereço não cria negócio.
              </p>
            )}
            {!inboundEndpoint ? (
              <Button
                variant="primary"
                className="mt-3"
                disabled={saveInbound.isPending || !pipelineId}
                onClick={() => saveInbound.mutate(true)}
              >
                {saveInbound.isPending ? "Gerando…" : "Gerar chave"}
              </Button>
            ) : (
              <button
                type="button"
                className="mt-2 text-[11px] text-podium-muted underline-offset-2 hover:text-podium-gray hover:underline"
                disabled={saveInbound.isPending}
                onClick={() => saveInbound.mutate(true)}
              >
                Gerar outra chave
              </button>
            )}
          </Step>

          <Step n={3} title="O que enviar">
            <ul className="space-y-1 text-xs text-podium-gray">
              {GRID_FIELDS.map((field) => (
                <li key={field.id} className="flex gap-2">
                  <span className="w-20 shrink-0">{field.label}</span>
                  <span className="font-mono text-[11px] text-podium-muted">
                    {field.id}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-podium-muted">
              Também vale razao_social, telefone, full_name, observacao.
            </p>
            <button
              type="button"
              className="mt-2 text-[11px] font-medium text-podium-yellow underline-offset-2 hover:underline"
              onClick={() => setShowSample((open) => !open)}
            >
              {showSample ? "Ocultar exemplo" : "Ver exemplo"}
            </button>
            {showSample ? (
              <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-podium-muted">
                {sampleJson}
              </pre>
            ) : null}
          </Step>

          <Step n={4} title="Pronto">
            <p className="text-sm text-podium-gray">
              Leads entram em {pipelineName} / {stageName}.
            </p>
            {destinationDirty ? (
              <Button
                variant="primary"
                className="mt-3"
                disabled={saveInbound.isPending || !pipelineId}
                onClick={() => saveInbound.mutate(false)}
              >
                {saveInbound.isPending ? "Guardando…" : "Usar este nicho"}
              </Button>
            ) : inboundEndpoint ? (
              <p className="mt-1 text-[11px] text-podium-muted">
                Destino da integração alinhado com o quadro.
              </p>
            ) : null}
            {saveInbound.isError ? (
              <p className="mt-2 text-sm text-podium-alert">
                {(saveInbound.error as Error).message}
              </p>
            ) : null}
            {inboundQuery.isError ? (
              <p className="mt-2 text-sm text-podium-alert">
                Não foi possível carregar a integração.
              </p>
            ) : null}
          </Step>
        </GlassCard>
      </div>
    </div>
  );
}
