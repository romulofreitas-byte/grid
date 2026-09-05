"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Copy, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { COPY } from "@/lib/copy";
import { pickEntradaStage } from "@/lib/crm/cadence";
import { crmFetch } from "@/lib/crm/client";
import {
  INBOUND_COMPANY_EXAMPLE,
  INBOUND_PERSON_EXAMPLE,
} from "@/lib/crm/inbound-examples";
import {
  inboundEventTone,
  inboundPayloadLine,
  type PublicInboundEvent,
  type PublicInboundLastEvent,
} from "@/lib/crm/inbound-events";
import {
  AUTOMATION_LIMIT,
  type CrmBoard,
  type CrmFormChannel,
  type CrmLeadKind,
  type CrmPipelineSummary,
  type CrmStage,
} from "@/lib/crm/types";
import { cn } from "@/lib/utils";

const INPUT =
  "w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 text-sm text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

const NEW_PIPELINE = "__new__";

type PublicEndpoint = {
  id: string;
  nome: string;
  pipeline_id: string;
  stage_id: string | null;
  lead_kind: CrmLeadKind;
  channel: CrmFormChannel;
  url: string;
  created_at: string;
  updated_at: string;
  last_event: PublicInboundLastEvent | null;
};

type InboundList = {
  endpoints: PublicEndpoint[];
  limit: number;
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

function CopyField({
  value,
  ariaLabel,
}: {
  value: string;
  ariaLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-h-[2.5rem] items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-podium-gray">
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

function DestinationFields({
  pipelines,
  stages,
  pipelineValue,
  pipelineNome,
  stageId,
  onPipeline,
  onNome,
  onStage,
}: {
  pipelines: CrmPipelineSummary[];
  stages: Array<{ id: string; nome: string }>;
  pipelineValue: string;
  pipelineNome: string;
  stageId: string;
  onPipeline: (value: string) => void;
  onNome: (value: string) => void;
  onStage: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Lista no CRM">
        <select
          className={INPUT}
          value={pipelineValue}
          onChange={(event) => onPipeline(event.target.value)}
        >
          <option value={NEW_PIPELINE}>Nova lista no CRM</option>
          {pipelines.map((pipeline) => (
            <option key={pipeline.id} value={pipeline.id}>
              {pipeline.nome}
            </option>
          ))}
        </select>
      </Field>
      {pipelineValue === NEW_PIPELINE ? (
        <Field label="Nome da lista">
          <input
            className={INPUT}
            value={pipelineNome}
            maxLength={80}
            onChange={(event) => onNome(event.target.value)}
          />
        </Field>
      ) : (
        <Field label="Etapa">
          <select
            className={INPUT}
            value={stageId}
            onChange={(event) => onStage(event.target.value)}
          >
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.nome}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}

export function AutomacoesPanel({
  initialPipelines,
}: {
  initialPipelines: CrmPipelineSummary[];
}) {
  const qc = useQueryClient();
  const [pipelines, setPipelines] = useState(initialPipelines);
  const [nome, setNome] = useState("");
  const [channel, setChannel] = useState<CrmFormChannel>("site");
  const [leadKind, setLeadKind] = useState<CrmLeadKind>("company");
  const [dest, setDest] = useState(NEW_PIPELINE);
  const [pipelineNome, setPipelineNome] = useState("");
  const [stageId, setStageId] = useState("");
  const [plainTokens, setPlainTokens] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [createdNome, setCreatedNome] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PublicEndpoint | null>(
    null,
  );
  const reduceMotion = useReducedMotion();

  const listQuery = useQuery({
    queryKey: ["crm-inbound"],
    queryFn: async () => {
      const res = await fetch("/api/crm/inbound");
      if (!res.ok) throw new Error("Não foi possível carregar as campanhas");
      return (await res.json()) as InboundList;
    },
  });

  const stagesQuery = useQuery({
    queryKey: ["crm-stages", dest],
    enabled: dest !== NEW_PIPELINE,
    queryFn: async () => {
      const res = await fetch(`/api/crm/pipelines/${dest}/stages`);
      if (!res.ok) throw new Error("Não foi possível carregar a lista");
      return (await res.json()) as { stages: CrmStage[] };
    },
  });

  const stages = dest === NEW_PIPELINE ? [] : (stagesQuery.data?.stages ?? []);
  const resolvedStageId = useMemo(() => {
    if (stages.some((stage) => stage.id === stageId)) return stageId;
    return pickEntradaStage(stages)?.id ?? stages[0]?.id ?? "";
  }, [stageId, stages]);

  async function resolvePipeline(): Promise<{
    pipelineId: string;
    stageId: string | null;
  }> {
    if (dest !== NEW_PIPELINE) {
      return { pipelineId: dest, stageId: resolvedStageId || null };
    }
    const nomeLista = pipelineNome.trim();
    if (!nomeLista) throw new Error("Dê um nome à lista nova.");
    const created = await crmFetch<{
      pipeline: CrmPipelineSummary;
      board: CrmBoard;
    }>("/api/crm/pipelines", {
      method: "POST",
      body: JSON.stringify({ nome: nomeLista }),
    });
    const createdSummary = { ...created.pipeline, deal_count: 0 };
    setPipelines((current) =>
      current.some((row) => row.id === createdSummary.id)
        ? current
        : [...current, createdSummary],
    );
    setDest(createdSummary.id);
    const entrada = pickEntradaStage(created.board.stages)?.id ?? "";
    setStageId(entrada);
    return { pipelineId: createdSummary.id, stageId: entrada || null };
  }

  const createCampaign = useMutation({
    mutationFn: async () => {
      const destination = await resolvePipeline();
      const res = await fetch("/api/crm/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          pipeline_id: destination.pipelineId,
          stage_id: destination.stageId,
          lead_kind: leadKind,
          channel,
        }),
      });
      const json = (await res.json()) as {
        endpoint?: PublicEndpoint;
        token?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível criar");
      return json;
    },
    onSuccess: (data) => {
      if (data.endpoint && data.token) {
        setPlainTokens((current) => ({
          ...current,
          [data.endpoint!.id]: data.token!,
        }));
        setOpenId(data.endpoint.id);
        setCreatedNome(data.endpoint.nome);
      }
      setFormOpen(false);
      setNome("");
      setChannel("site");
      setLeadKind("company");
      setDest(NEW_PIPELINE);
      setPipelineNome("");
      setStageId("");
      void qc.invalidateQueries({ queryKey: ["crm-inbound"] });
    },
  });

  const patchCampaign = useMutation({
    mutationFn: async (input: {
      id: string;
      rotate?: boolean;
      pipeline_id?: string;
      stage_id?: string | null;
    }) => {
      const res = await fetch(`/api/crm/inbound/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rotate: input.rotate,
          pipeline_id: input.pipeline_id,
          stage_id: input.stage_id,
        }),
      });
      const json = (await res.json()) as {
        endpoint?: PublicEndpoint;
        token?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível salvar");
      return json;
    },
    onSuccess: (data) => {
      if (data.endpoint && data.token) {
        setPlainTokens((current) => ({
          ...current,
          [data.endpoint!.id]: data.token!,
        }));
      }
      void qc.invalidateQueries({ queryKey: ["crm-inbound"] });
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crm/inbound/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível apagar");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["crm-inbound"] });
    },
  });

  const endpoints = listQuery.data?.endpoints ?? [];
  const atCap = endpoints.length >= (listQuery.data?.limit ?? AUTOMATION_LIMIT);
  const openEndpoint = endpoints.find((row) => row.id === openId) ?? null;
  const payloadKind = openEndpoint?.lead_kind ?? leadKind;
  const payloadChannel = openEndpoint?.channel ?? channel;
  const payloadExample =
    payloadKind === "person" ? INBOUND_PERSON_EXAMPLE : INBOUND_COMPANY_EXAMPLE;

  return (
    <div className="mt-6 space-y-6">
      <GlassCard className="p-6 hover:translate-y-0 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
              Campanhas
            </p>
            {formOpen ? (
              <h3 className="mt-2 text-base font-semibold text-podium-white">
                Nova automação
              </h3>
            ) : createdNome ? (
              <p className="mt-2 text-sm text-podium-gray">
                {COPY.automacoesReadyBar.replace("{nome}", createdNome)}
              </p>
            ) : (
              <p className="mt-2 text-sm text-podium-muted">
                {COPY.automacoesHint}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] text-podium-muted">
              {endpoints.length} de {listQuery.data?.limit ?? AUTOMATION_LIMIT}
            </p>
            {formOpen ? (
              <button
                type="button"
                aria-label="Fechar nova automação"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-podium-muted transition duration-200 ease-out hover:bg-white/5 hover:text-podium-white"
                onClick={() => setFormOpen(false)}
              >
                <ChevronDown className="h-4 w-4 rotate-180 transition duration-200 ease-out" />
              </button>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            "grid",
            !formOpen && "mt-5",
            formOpen ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
            !reduceMotion && "transition-[grid-template-rows] duration-200 ease-out",
          )}
        >
          <div className="min-h-0 overflow-hidden" inert={formOpen}>
            <Button
              variant="primary"
              disabled={atCap}
              onClick={() => {
                setCreatedNome(null);
                setFormOpen(true);
              }}
            >
              {atCap ? "Limite de 10 atingido" : COPY.automacoesNewCta}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "grid",
            formOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            !reduceMotion && "transition-[grid-template-rows] duration-200 ease-out",
          )}
        >
          <div className="min-h-0 overflow-hidden" inert={!formOpen}>
            <div className="space-y-5 pt-5">
              <Hint>{COPY.automacoesHint}</Hint>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome da campanha">
                  <input
                    className={INPUT}
                    value={nome}
                    maxLength={80}
                    placeholder="Meta Lead Ads · cliente X"
                    onChange={(event) => {
                      setCreatedNome(null);
                      setNome(event.target.value);
                    }}
                  />
                </Field>
                <Field label="Canal">
                  <select
                    className={INPUT}
                    value={channel}
                    onChange={(event) =>
                      setChannel(event.target.value as CrmFormChannel)
                    }
                  >
                    <option value="site">Site / formulário</option>
                    <option value="ads">Anúncio</option>
                  </select>
                </Field>
                <Field label="Tipo de lead">
                  <select
                    className={INPUT}
                    value={leadKind}
                    onChange={(event) =>
                      setLeadKind(event.target.value as CrmLeadKind)
                    }
                  >
                    <option value="company">Empresa</option>
                    <option value="person">Pessoa</option>
                  </select>
                </Field>
              </div>

              <DestinationFields
                pipelines={pipelines}
                stages={stages}
                pipelineValue={dest}
                pipelineNome={pipelineNome}
                stageId={resolvedStageId}
                onPipeline={(value) => {
                  setDest(value);
                  setStageId("");
                }}
                onNome={setPipelineNome}
                onStage={setStageId}
              />

              <Button
                variant="primary"
                disabled={createCampaign.isPending || atCap || !nome.trim()}
                onClick={() => createCampaign.mutate()}
              >
                {createCampaign.isPending
                  ? "Criando…"
                  : atCap
                    ? "Limite de 10 atingido"
                    : "Criar campanha"}
              </Button>
              <div className="rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-3 text-sm text-podium-muted">
                {COPY.automacoesUnlockBar}
              </div>
              {atCap ? (
                <p className="text-sm text-podium-alert">
                  Apague uma campanha parada ou fale com a gente.
                </p>
              ) : null}
              {createCampaign.isError ? (
                <p className="text-sm text-podium-alert">
                  {(createCampaign.error as Error).message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </GlassCard>

      {endpoints.length > 0 ? (
        <GlassCard className="space-y-4 p-6 hover:translate-y-0 md:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
              Suas campanhas
            </p>
            <Hint className="mt-2">{COPY.automacoesListHint}</Hint>
          </div>
          <div className="space-y-2">
            {endpoints.map((endpoint) => (
              <CampaignRow
                key={endpoint.id}
                endpoint={endpoint}
                pipelineName={
                  pipelines.find(
                    (pipeline) => pipeline.id === endpoint.pipeline_id,
                  )?.nome ?? "lista"
                }
                token={plainTokens[endpoint.id]}
                open={openId === endpoint.id}
                reduceMotion={Boolean(reduceMotion)}
                busy={deleteCampaign.isPending || patchCampaign.isPending}
                onToggle={(next) => setOpenId(next ? endpoint.id : null)}
                onDelete={() => setPendingDelete(endpoint)}
                onRotate={() =>
                  patchCampaign.mutate({ id: endpoint.id, rotate: true })
                }
              />
            ))}
          </div>
        </GlassCard>
      ) : null}

      {listQuery.isError ? (
        <p className="text-sm text-podium-alert">
          Não foi possível carregar as campanhas.
        </p>
      ) : null}

      <GlassCard className="space-y-5 p-6 hover:translate-y-0 md:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
            Payload
          </p>
          <h3 className="mt-2 text-base font-semibold text-podium-white">
            {payloadKind === "person" ? "JSON — pessoa" : "JSON — empresa"}
          </h3>
          <Hint className="mt-2">
            {payloadChannel === "ads"
              ? COPY.automacoesPayloadAds
              : COPY.automacoesPayloadSite}
          </Hint>
        </div>
        <p className="text-[11px] text-podium-muted">
          {payloadKind === "person"
            ? "Cria um cartão no nome da pessoa, sem CNPJ."
            : "Cria um cartão com razão social, contato e CNPJ."}
        </p>
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-podium-muted">
          {JSON.stringify(payloadExample, null, 2)}
        </pre>
      </GlassCard>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={COPY.automacoesDeleteTitle.replace(
          "{nome}",
          pendingDelete?.nome ?? "",
        )}
        body={COPY.automacoesDeleteBody}
        confirmLabel={COPY.automacoesDeleteConfirm}
        pendingLabel={COPY.automacoesDeletePending}
        pending={deleteCampaign.isPending}
        onClose={() => {
          if (deleteCampaign.isPending) return;
          setPendingDelete(null);
        }}
        onConfirm={() => {
          if (!pendingDelete) return;
          const id = pendingDelete.id;
          deleteCampaign.mutate(id, {
            onSuccess: () => {
              setOpenId((current) => (current === id ? null : current));
              setPendingDelete(null);
            },
          });
        }}
      />
    </div>
  );
}

function CampaignRow({
  endpoint,
  pipelineName,
  token,
  open,
  reduceMotion,
  busy,
  onToggle,
  onDelete,
  onRotate,
}: {
  endpoint: PublicEndpoint;
  pipelineName: string;
  token?: string;
  open: boolean;
  reduceMotion: boolean;
  busy: boolean;
  onToggle: (next: boolean) => void;
  onDelete: () => void;
  onRotate: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-white/[0.04] transition-[border-color] duration-200 ease-out",
        open && "border-podium-yellow/25",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => onToggle(!open)}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-podium-white">
              {endpoint.nome}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-podium-muted">
              {pipelineName}
              {" · "}
              {endpoint.lead_kind === "person" ? "pessoa" : "empresa"}
              {" · "}
              {endpoint.channel === "ads" ? "anúncio" : "site"}
            </p>
          </div>
          {endpoint.last_event ? (
            <Badge variant={inboundEventTone(endpoint.last_event.status)}>
              {lastEventLabel(endpoint.last_event.status)}
            </Badge>
          ) : null}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-podium-muted transition-transform duration-200 ease-out",
              open && "rotate-180 text-podium-yellow",
            )}
          />
        </button>
        <button
          type="button"
          aria-label={`Apagar ${endpoint.nome}`}
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-podium-muted transition duration-200 ease-out hover:bg-white/5 hover:text-podium-alert",
            busy && "opacity-50",
          )}
          disabled={busy}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div
        className={cn(
          "grid",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          !reduceMotion &&
            "transition-[grid-template-rows] duration-200 ease-out",
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="space-y-4 px-4 pb-4">
            <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] text-podium-muted">Endereço</p>
            <CopyField value={endpoint.url} ariaLabel="Copiar endereço" />
            <p className="mt-1.5 text-[11px] text-podium-muted">
              {endpoint.channel === "ads"
                ? "Cole no URL do módulo HTTP. Só desta campanha."
                : "Cole no POST do formulário. Só desta campanha."}
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] text-podium-muted">
              Authorization · token
            </p>
            {token ? (
              <CopyField
                value={`Bearer ${token}`}
                ariaLabel="Copiar valor do header"
              />
            ) : (
              <div className="flex min-h-[2.5rem] items-center rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-[11px] text-podium-muted">
                  Chave oculta. Se perdeu, gere outra — a antiga para de
                  funcionar.
                </p>
              </div>
            )}
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-podium-muted">
                {token
                  ? "Guarde agora. O Grid não mostra de novo."
                  : endpoint.channel === "ads"
                    ? "Cole no header do Make, junto com o endereço."
                    : "Cole no header Authorization do site, junto com o endereço."}
              </p>
              <button
                type="button"
                className="shrink-0 text-[11px] text-podium-muted underline-offset-2 hover:text-podium-gray hover:underline disabled:opacity-50"
                disabled={busy}
                onClick={onRotate}
              >
                Gerar outra chave
              </button>
            </div>
          </div>
        </div>
        <CampaignHelp endpoint={endpoint} token={token} />
        {open ? <CampaignEvents endpointId={endpoint.id} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function siteFetchSnippet(
  url: string,
  authorization: string,
  kind: CrmLeadKind,
): string {
  const body =
    kind === "person"
      ? `{
    kind: "person",
    name: "João da Silva",
    phone: "11981887766",
    email: "joao@gmail.com"
  }`
      : `{
    kind: "company",
    company: "Empresa Ltda",
    name: "Maria Silva",
    phone: "5432892400",
    email: "maria@empresa.com.br"
  }`;
  return `fetch("${url}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "${authorization}"
  },
  body: JSON.stringify(${body})
});`;
}

function lastEventLabel(status: PublicInboundLastEvent["status"]) {
  if (status === "created") return COPY.automacoesLastCreated;
  if (status === "skipped") return COPY.automacoesLastSkipped;
  return COPY.automacoesLastError;
}

function snapshotLine(event: PublicInboundEvent): string {
  return [event.snapshot.company, event.snapshot.name, event.snapshot.cnpj]
    .filter(Boolean)
    .join(" · ");
}

function CampaignEvents({ endpointId }: { endpointId: string }) {
  const query = useQuery({
    queryKey: ["crm-inbound-events", endpointId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/inbound/${endpointId}/events`);
      const json = (await res.json()) as {
        events?: PublicInboundEvent[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível ler os envios");
      return json.events ?? [];
    },
  });

  return (
    <div className="space-y-2 border-t border-white/10 pt-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-podium-muted">
        {COPY.automacoesEventsTitle}
      </p>
      <Hint>{COPY.automacoesEventsHint}</Hint>
      {query.isPending ? (
        <p className="text-[11px] text-podium-muted">Abrindo os envios…</p>
      ) : null}
      {query.isError ? (
        <p className="text-[11px] text-podium-alert">
          {(query.error as Error).message}
        </p>
      ) : null}
      {query.data && query.data.length === 0 ? (
        <p className="text-sm text-podium-muted">{COPY.automacoesEventsEmpty}</p>
      ) : null}
      {query.data && query.data.length > 0 ? (
        <ul className="space-y-2">
          {query.data.slice(0, 8).map((event) => (
            <li key={event.id} className="text-[11px] text-podium-muted">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={inboundEventTone(event.status)}>
                  {lastEventLabel(event.status)}
                </Badge>
                <span>
                  {new Date(event.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <p
                className={
                  event.status === "error"
                    ? "mt-1 text-podium-alert"
                    : "mt-1"
                }
              >
                {event.message}
                {snapshotLine(event) ? ` · ${snapshotLine(event)}` : ""}
              </p>
              {inboundPayloadLine(event.payload) ? (
                <p className="mt-0.5 truncate font-mono text-[10px] text-podium-muted">
                  {inboundPayloadLine(event.payload)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CampaignHelp({
  endpoint,
  token,
}: {
  endpoint: PublicEndpoint;
  token?: string;
}) {
  const isAds = endpoint.channel === "ads";
  const authorization = token ? `Bearer ${token}` : "Bearer SUA_CHAVE";
  const snippet = siteFetchSnippet(endpoint.url, authorization, endpoint.lead_kind);

  return (
    <div className="space-y-3">
      {isAds ? (
        <ol className="space-y-1.5 text-sm text-podium-gray">
          <li>
            <span className="font-semibold text-podium-white">1. </span>
            No Make, módulo HTTP. Método POST.
          </li>
          <li>
            <span className="font-semibold text-podium-white">2. </span>
            Cole o endereço desta campanha no URL.
          </li>
          <li>
            <span className="font-semibold text-podium-white">3. </span>
            Header Authorization: cole o token (já vem com Bearer).
          </li>
        </ol>
      ) : (
        <ol className="space-y-1.5 text-sm text-podium-gray">
          <li>
            <span className="font-semibold text-podium-white">1. </span>
            No envio do formulário, faça POST no endereço desta campanha.
          </li>
          <li>
            <span className="font-semibold text-podium-white">2. </span>
            Header Authorization: cole o token (já vem com Bearer).
          </li>
          <li>
            <span className="font-semibold text-podium-white">3. </span>
            Body em JSON. {COPY.automacoesJsonBelow}
          </li>
        </ol>
      )}
      {isAds ? null : (
        <details
          className="rounded-xl border border-white/10 bg-black/20"
          onClick={(event) => event.stopPropagation()}
          onToggle={(event) => event.stopPropagation()}
        >
          <summary
            className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[11px] font-semibold text-podium-white [&::-webkit-details-marker]:hidden"
            onClick={(event) => event.stopPropagation()}
          >
            Código do site
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-podium-muted" />
          </summary>
          <div className="space-y-2 px-3 pb-3">
            <div className="flex justify-end">
              <SnippetCopy value={snippet} />
            </div>
            <pre className="overflow-x-auto text-[11px] text-podium-muted">
              {snippet}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}

function SnippetCopy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-[11px] text-podium-muted hover:text-podium-gray"
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
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}
