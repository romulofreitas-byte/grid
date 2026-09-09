"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Copy,
  Link2,
  Megaphone,
  Settings,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { IntegracoesCategoryChips } from "@/components/integracoes/IntegracoesCategoryChips";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { MetaConnectCard } from "@/components/integracoes/MetaConnectCard";
import { COPY } from "@/lib/copy";
import { publicFormEmbedSnippet } from "@/lib/crm/inbound-token";
import { pickEntradaStage } from "@/lib/crm/cadence";
import { crmFetch } from "@/lib/crm/client";
import {
  inboundEventTone,
  inboundPayloadLine,
  type PublicInboundEvent,
  type PublicInboundLastEvent,
} from "@/lib/crm/inbound-events";
import {
  AUTOMATION_LIMIT,
  channelForCategory,
  formChannelLabel,
  matchesAutomacoesCategory,
  type AutomacoesCategory,
  type CrmBoard,
  type CrmFormChannel,
  type CrmFormFields,
  type CrmLeadKind,
  type CrmMetaConnection,
  type CrmPipelineSummary,
  type CrmStage,
} from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import {
  workSplitClass,
  workSplitPaneClass,
  workSplitRailClass,
} from "@/lib/work-split";

const INPUT =
  "w-full rounded-md border border-white/10 bg-podium-panel px-2.5 py-1.5 text-xs text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

const NEW_PIPELINE = "__new__";

type PublicEndpoint = {
  id: string;
  nome: string;
  pipeline_id: string;
  stage_id: string | null;
  lead_kind: CrmLeadKind;
  channel: CrmFormChannel;
  form_fields: CrmFormFields;
  meta_connection_id: string | null;
  meta_form_id: string | null;
  url: string;
  form_url: string | null;
  embed_snippet: string | null;
  has_public_form: boolean;
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
    <label className="block text-xs text-podium-gray">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CopyButton({
  value,
  label,
  variant = "primary",
}: {
  value: string;
  label: string;
  variant?: ButtonVariant;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant={copied ? "secondary" : variant}
      disabled={!value}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? COPY.automacoesCopied : label}
    </Button>
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
  allowNew = true,
}: {
  pipelines: CrmPipelineSummary[];
  stages: Array<{ id: string; nome: string }>;
  pipelineValue: string;
  pipelineNome: string;
  stageId: string;
  onPipeline: (value: string) => void;
  onNome: (value: string) => void;
  onStage: (value: string) => void;
  allowNew?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Lista no CRM">
        <Select
          value={pipelineValue}
          onChange={onPipeline}
          className="w-full"
          options={[
            ...(allowNew
              ? [{ value: NEW_PIPELINE, label: "Nova lista no CRM" }]
              : []),
            ...pipelines.map((pipeline) => ({
              value: pipeline.id,
              label: pipeline.nome,
            })),
          ]}
        />
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
          <Select
            value={stageId}
            onChange={onStage}
            className="w-full"
            options={stages.map((stage) => ({
              value: stage.id,
              label: stage.nome,
            }))}
          />
        </Field>
      )}
    </div>
  );
}

function categoryHint(category: AutomacoesCategory): string {
  if (category === "captar") return COPY.automacoesCaptarHint;
  if (category === "avancado") return COPY.automacoesAvancadoHint;
  return COPY.automacoesMetaDestHint;
}

function categoryNewCta(category: AutomacoesCategory): string {
  if (category === "captar") return COPY.automacoesNewCaptarCta;
  if (category === "avancado") return COPY.automacoesNewAvancadoCta;
  return COPY.automacoesNewMetaCta;
}

function categoryCreateTitle(category: AutomacoesCategory): string {
  if (category === "captar") return COPY.automacoesCreateCaptarTitle;
  if (category === "avancado") return COPY.automacoesCreateAvancadoTitle;
  return COPY.automacoesCreateMetaTitle;
}

function categoryPlaceholder(category: AutomacoesCategory): string {
  if (category === "captar") return COPY.automacoesPlaceholderCaptar;
  if (category === "avancado") return COPY.automacoesPlaceholderAvancado;
  return COPY.automacoesPlaceholderMeta;
}

function categoryReady(category: AutomacoesCategory, nome: string): string {
  const template =
    category === "captar"
      ? COPY.automacoesReadyCaptar
      : category === "avancado"
        ? COPY.automacoesReadyAvancado
        : COPY.automacoesReadyMeta;
  return template.replace("{nome}", nome);
}

function categoryEmptyList(category: AutomacoesCategory): string {
  if (category === "captar") return COPY.automacoesEmptyCaptarList;
  if (category === "avancado") return COPY.automacoesEmptyAvancadoList;
  return COPY.automacoesEmptyMetaList;
}

function categoryEmptyPane(category: AutomacoesCategory): string {
  if (category === "captar") return COPY.automacoesEmptyCaptarPane;
  if (category === "avancado") return COPY.automacoesEmptyAvancadoPane;
  return COPY.automacoesEmptyMetaPane;
}

function categoryDeleteBody(category: AutomacoesCategory): string {
  if (category === "captar") return COPY.automacoesDeleteBodyCaptar;
  if (category === "avancado") return COPY.automacoesDeleteBodyAvancado;
  return COPY.automacoesDeleteBodyMeta;
}

function chipCurrent(
  category: AutomacoesCategory,
): "conectar" | "captar" | "avancado" {
  if (category === "meta") return "conectar";
  return category;
}

export function AutomacoesPanel({
  initialPipelines,
  category,
}: {
  initialPipelines: CrmPipelineSummary[];
  category: AutomacoesCategory;
}) {
  const qc = useQueryClient();
  const channel = channelForCategory(category);
  const [pipelines, setPipelines] = useState(initialPipelines);
  const [nome, setNome] = useState("");
  const [leadKind, setLeadKind] = useState<CrmLeadKind>("company");
  const [dest, setDest] = useState(NEW_PIPELINE);
  const [pipelineNome, setPipelineNome] = useState("");
  const [stageId, setStageId] = useState("");
  const [plainTokens, setPlainTokens] = useState<Record<string, string>>({});
  const [publicTokens, setPublicTokens] = useState<Record<string, string>>({});
  const [metaConnectionId, setMetaConnectionId] = useState("");
  const [metaFormId, setMetaFormId] = useState("");
  const [includeCompany, setIncludeCompany] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [createdNome, setCreatedNome] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PublicEndpoint | null>(
    null,
  );
  const [metaFlash, setMetaFlash] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const meta = params.get("meta");
    if (meta === "ok") setMetaFlash(COPY.automacoesMetaConnected);
    else if (meta === "denied") setMetaFlash(COPY.automacoesMetaDenied);
    else if (meta === "error") setMetaFlash(COPY.automacoesMetaError);
    else if (meta === "nopages") setMetaFlash(COPY.automacoesMetaNoPages);
    if (meta) {
      params.delete("meta");
      const next = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

  const listQuery = useQuery({
    queryKey: ["crm-inbound"],
    queryFn: async () => {
      const res = await fetch("/api/crm/inbound");
      if (!res.ok) throw new Error("Não foi possível carregar as campanhas");
      return (await res.json()) as InboundList;
    },
  });

  const pagesQuery = useQuery({
    queryKey: ["crm-meta-pages"],
    enabled: category === "meta",
    queryFn: async () => {
      const res = await fetch("/api/automacoes/meta/pages");
      if (!res.ok) throw new Error("pages");
      return (await res.json()) as {
        pages: CrmMetaConnection[];
        configured: boolean;
      };
    },
  });

  const formsQuery = useQuery({
    queryKey: ["crm-meta-forms", metaConnectionId],
    enabled: category === "meta" && Boolean(metaConnectionId),
    queryFn: async () => {
      const res = await fetch(
        `/api/automacoes/meta/forms?connection=${encodeURIComponent(metaConnectionId)}`,
      );
      if (!res.ok) return { forms: [] as Array<{ id: string; name: string }> };
      return (await res.json()) as { forms: Array<{ id: string; name: string }> };
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
          form_fields:
            channel === "site" ? { company: includeCompany } : undefined,
          meta_connection_id:
            channel === "meta" && metaConnectionId ? metaConnectionId : undefined,
          meta_form_id:
            channel === "meta" && metaFormId ? metaFormId : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        endpoint?: PublicEndpoint;
        token?: string | null;
        public_token?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível criar");
      return json;
    },
    onSuccess: (data) => {
      if (data.endpoint) {
        setOpenId(data.endpoint.id);
        setCreatedNome(data.endpoint.nome);
        if (data.token) {
          setPlainTokens((current) => ({
            ...current,
            [data.endpoint!.id]: data.token!,
          }));
        }
        if (data.public_token) {
          setPublicTokens((current) => ({
            ...current,
            [data.endpoint!.id]: data.public_token!,
          }));
        }
      }
      setFormOpen(false);
      setNome("");
      setLeadKind("company");
      setMetaConnectionId("");
      setMetaFormId("");
      setIncludeCompany(false);
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
      rotate_public?: boolean;
      pipeline_id?: string;
      stage_id?: string | null;
    }) => {
      const res = await fetch(`/api/crm/inbound/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rotate: input.rotate,
          rotate_public: input.rotate_public,
          pipeline_id: input.pipeline_id,
          stage_id: input.stage_id,
        }),
      });
      const json = (await res.json()) as {
        endpoint?: PublicEndpoint;
        token?: string | null;
        public_token?: string | null;
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
      if (data.endpoint && data.public_token) {
        setPublicTokens((current) => ({
          ...current,
          [data.endpoint!.id]: data.public_token!,
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

  const allEndpoints = listQuery.data?.endpoints ?? [];
  const endpoints = allEndpoints.filter((row) =>
    matchesAutomacoesCategory(row.channel, category),
  );
  const atCap = allEndpoints.length >= (listQuery.data?.limit ?? AUTOMATION_LIMIT);
  const openEndpoint = endpoints.find((row) => row.id === openId) ?? null;
  const metaPages = pagesQuery.data?.pages ?? [];
  const metaAppReady = pagesQuery.data?.configured;

  useEffect(() => {
    if (formOpen) return;
    if (openId && endpoints.some((row) => row.id === openId)) return;
    setOpenId(endpoints[0]?.id ?? null);
  }, [endpoints, formOpen, openId]);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="shrink-0">
          <IntegracoesCategoryChips current={chipCurrent(category)} />
        </div>
        <div className={workSplitClass}>
          <div className={cn(workSplitRailClass, "space-y-3")}>
            <div className="flex shrink-0 items-center justify-between gap-2">
              <p className="text-[11px] text-podium-muted">
                {allEndpoints.length} de {listQuery.data?.limit ?? AUTOMATION_LIMIT}
              </p>
              <Button
                variant="primary"
                disabled={atCap || formOpen}
                onClick={() => {
                  setCreatedNome(null);
                  setFormOpen(true);
                }}
              >
                {atCap ? "Limite de 10 atingido" : categoryNewCta(category)}
              </Button>
            </div>
            {createdNome && !formOpen ? (
              <p className="text-sm text-podium-gray">
                {categoryReady(category, createdNome)}
              </p>
            ) : null}
            {metaFlash ? (
              <p className="text-sm text-podium-gray">{metaFlash}</p>
            ) : null}
            {listQuery.isPending ? (
              <p className="text-sm text-podium-muted">{COPY.automacoesOpening}</p>
            ) : endpoints.length > 0 ? (
              <div className="space-y-1">
                {endpoints.map((endpoint) => (
                  <CampaignRow
                    key={endpoint.id}
                    endpoint={endpoint}
                    pipelineName={
                      pipelines.find(
                        (pipeline) => pipeline.id === endpoint.pipeline_id,
                      )?.nome ?? "lista"
                    }
                    selected={!formOpen && openId === endpoint.id}
                    busy={deleteCampaign.isPending || patchCampaign.isPending}
                    onSelect={() => {
                      setFormOpen(false);
                      setOpenId(endpoint.id);
                    }}
                    onDelete={() => setPendingDelete(endpoint)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-podium-muted">
                {categoryEmptyList(category)}
              </p>
            )}
            {listQuery.isError ? (
              <p className="text-sm text-podium-alert">
                Não foi possível carregar as campanhas.
              </p>
            ) : null}
          </div>

          <div className={cn(workSplitPaneClass, "space-y-3")}>
            {formOpen ? (
              <GlassCard className="space-y-4 p-3 hover:translate-y-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-podium-white">
                    {categoryCreateTitle(category)}
                  </p>
                  <button
                    type="button"
                    aria-label="Fechar"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-podium-muted hover:bg-white/5 hover:text-podium-white"
                    onClick={() => setFormOpen(false)}
                  >
                    <ChevronDown className="h-4 w-4 rotate-180" />
                  </button>
                </div>
                <Hint>{categoryHint(category)}</Hint>
                <div className="grid gap-3 sm:grid-cols-2">
                  {category === "captar" ? (
                    <Field label="Tipo de lead">
                      <Select
                        value={leadKind}
                        onChange={(value) => setLeadKind(value as CrmLeadKind)}
                        className="w-full"
                        options={[
                          { value: "company", label: "Empresa" },
                          { value: "person", label: "Pessoa" },
                        ]}
                      />
                    </Field>
                  ) : null}
                  <Field label="Nome">
                    <input
                      className={INPUT}
                      value={nome}
                      maxLength={80}
                      placeholder={categoryPlaceholder(category)}
                      onChange={(event) => {
                        setCreatedNome(null);
                        setNome(event.target.value);
                      }}
                    />
                  </Field>
                  {category !== "captar" ? (
                    <Field label="Tipo de lead">
                      <Select
                        value={leadKind}
                        onChange={(value) => setLeadKind(value as CrmLeadKind)}
                        className="w-full"
                        options={[
                          { value: "company", label: "Empresa" },
                          { value: "person", label: "Pessoa" },
                        ]}
                      />
                    </Field>
                  ) : null}
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
                {category === "captar" ? (
                  <label className="flex items-center gap-2 text-xs text-podium-gray">
                    <input
                      type="checkbox"
                      checked={includeCompany}
                      onChange={(event) =>
                        setIncludeCompany(event.target.checked)
                      }
                    />
                    Pedir nome da empresa
                  </label>
                ) : null}
                {category === "meta" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Página do Meta">
                      <Select
                        value={metaConnectionId}
                        onChange={setMetaConnectionId}
                        className="w-full"
                        options={[
                          { value: "", label: "Escolha a Página" },
                          ...(pagesQuery.data?.pages ?? []).map((page) => ({
                            value: page.id,
                            label: page.page_name,
                          })),
                        ]}
                      />
                    </Field>
                    <Field label="Formulário Instantâneo">
                      <Select
                        value={metaFormId}
                        onChange={setMetaFormId}
                        className="w-full"
                        options={[
                          { value: "", label: COPY.automacoesAllMetaForms },
                          ...(formsQuery.data?.forms ?? []).map((form) => ({
                            value: form.id,
                            label: form.name,
                          })),
                        ]}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <MetaConnectCard
                        compact
                        pages={metaPages}
                        configured={metaAppReady}
                      />
                    </div>
                  </div>
                ) : null}
                <Button
                  variant="primary"
                  disabled={
                    createCampaign.isPending ||
                    atCap ||
                    !nome.trim() ||
                    (category === "meta" && !metaConnectionId)
                  }
                  onClick={() => createCampaign.mutate()}
                >
                  {createCampaign.isPending
                    ? "Criando…"
                    : atCap
                      ? "Limite de 10 atingido"
                      : categoryNewCta(category)}
                </Button>
                {category === "avancado" ? (
                  <div className="rounded-md border border-dashed border-white/15 bg-black/20 px-4 py-3 text-sm text-podium-muted">
                    {COPY.automacoesUnlockBar}
                  </div>
                ) : null}
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
              </GlassCard>
            ) : openEndpoint ? (
              <CampaignDetail
                endpoint={openEndpoint}
                pipelines={pipelines}
                token={plainTokens[openEndpoint.id]}
                publicToken={publicTokens[openEndpoint.id]}
                busy={deleteCampaign.isPending || patchCampaign.isPending}
                onRotate={() =>
                  patchCampaign.mutate({ id: openEndpoint.id, rotate: true })
                }
                onRotatePublic={() =>
                  patchCampaign.mutate({
                    id: openEndpoint.id,
                    rotate_public: true,
                  })
                }
                onDestination={(pipeline_id, stage_id) =>
                  patchCampaign.mutate({
                    id: openEndpoint.id,
                    pipeline_id,
                    stage_id,
                  })
                }
              />
            ) : (
              <p className="text-sm text-podium-muted">
                {categoryEmptyPane(category)}{" "}
                {category === "meta" ? (
                  <Link
                    href="/integracoes"
                    className="font-semibold text-podium-yellow"
                  >
                    {COPY.integracoesCatConectar}
                  </Link>
                ) : null}
              </p>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={COPY.automacoesDeleteTitle.replace(
          "{nome}",
          pendingDelete?.nome ?? "",
        )}
        body={categoryDeleteBody(category)}
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
    </>
  );
}

function channelIcon(channel: CrmFormChannel) {
  if (channel === "meta") return Megaphone;
  if (channel === "webhook" || channel === "ads") return Settings;
  return Link2;
}

function CampaignRow({
  endpoint,
  pipelineName,
  selected,
  busy,
  onSelect,
  onDelete,
}: {
  endpoint: PublicEndpoint;
  pipelineName: string;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const Icon = channelIcon(endpoint.channel);
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2",
        selected && "border-podium-yellow/40 bg-podium-yellow/10",
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={onSelect}
      >
        <Icon
          className="h-3.5 w-3.5 shrink-0 text-podium-yellow"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-podium-white">
            {endpoint.nome}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-podium-muted">
            {pipelineName}
            {" · "}
            {formChannelLabel(endpoint.channel)}
            {endpoint.last_event
              ? ` · ${lastEventLabel(endpoint.last_event.status)}`
              : ""}
          </p>
        </div>
        {endpoint.last_event ? (
          <Badge variant={inboundEventTone(endpoint.last_event.status)}>
            {lastEventLabel(endpoint.last_event.status)}
          </Badge>
        ) : null}
      </button>
      <button
        type="button"
        aria-label={`Apagar ${endpoint.nome}`}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-podium-muted hover:bg-white/5 hover:text-podium-alert",
          busy && "opacity-50",
        )}
        disabled={busy}
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function formUrls(
  publicToken: string | undefined,
  endpoint: PublicEndpoint,
): { formUrl: string | null; embed: string | null } {
  if (publicToken && typeof window !== "undefined") {
    return {
      formUrl: `${window.location.origin}/f/${publicToken}`,
      embed: publicFormEmbedSnippet(window.location.origin, publicToken),
    };
  }
  return { formUrl: endpoint.form_url, embed: endpoint.embed_snippet };
}

function CampaignDestinationEditor({
  endpoint,
  pipelines,
  busy,
  onSave,
}: {
  endpoint: PublicEndpoint;
  pipelines: CrmPipelineSummary[];
  busy: boolean;
  onSave: (pipelineId: string, stageId: string | null) => void;
}) {
  const [dest, setDest] = useState(endpoint.pipeline_id);
  const [stageId, setStageId] = useState(endpoint.stage_id ?? "");
  const stagesQuery = useQuery({
    queryKey: ["crm-stages", dest],
    enabled: Boolean(dest),
    queryFn: async () => {
      const res = await fetch(`/api/crm/pipelines/${dest}/stages`);
      if (!res.ok) throw new Error("Não foi possível carregar a lista");
      return (await res.json()) as { stages: CrmStage[] };
    },
  });
  const stages = stagesQuery.data?.stages ?? [];
  const resolvedStageId = useMemo(() => {
    if (stages.some((stage) => stage.id === stageId)) return stageId;
    return pickEntradaStage(stages)?.id ?? stages[0]?.id ?? "";
  }, [stageId, stages]);

  useEffect(() => {
    setDest(endpoint.pipeline_id);
    setStageId(endpoint.stage_id ?? "");
  }, [endpoint.id, endpoint.pipeline_id, endpoint.stage_id]);

  const dirty =
    dest !== endpoint.pipeline_id ||
    (resolvedStageId || null) !== (endpoint.stage_id ?? "");

  return (
    <div className="space-y-3">
      <DestinationFields
        allowNew={false}
        pipelines={pipelines}
        stages={stages}
        pipelineValue={dest}
        pipelineNome=""
        stageId={resolvedStageId}
        onPipeline={(value) => {
          setDest(value);
          setStageId("");
        }}
        onNome={() => undefined}
        onStage={setStageId}
      />
      {dirty ? (
        <Button
          type="button"
          variant="secondary"
          disabled={busy || !dest}
          onClick={() => onSave(dest, resolvedStageId || null)}
        >
          {COPY.automacoesSaveDestino}
        </Button>
      ) : null}
    </div>
  );
}

function CampaignDetail({
  endpoint,
  pipelines,
  token,
  publicToken,
  busy,
  onRotate,
  onRotatePublic,
  onDestination,
}: {
  endpoint: PublicEndpoint;
  pipelines: CrmPipelineSummary[];
  token?: string;
  publicToken?: string;
  busy: boolean;
  onRotate: () => void;
  onRotatePublic: () => void;
  onDestination: (pipelineId: string, stageId: string | null) => void;
}) {
  const pipelineName =
    pipelines.find((pipeline) => pipeline.id === endpoint.pipeline_id)?.nome ??
    "lista";
  const { formUrl, embed } = formUrls(publicToken, endpoint);
  const isSite = endpoint.channel === "site";
  const isWebhook =
    endpoint.channel === "webhook" || endpoint.channel === "ads";
  const isMeta = endpoint.channel === "meta";
  const bearer = token ? `Bearer ${token}` : "";

  return (
    <GlassCard className="space-y-4 p-3 hover:translate-y-0">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          {pipelineName}
        </p>
        <p className="mt-1 text-sm font-semibold text-podium-white">
          {endpoint.nome}
        </p>
        <p className="mt-0.5 text-[11px] text-podium-muted">
          {endpoint.lead_kind === "person" ? "pessoa" : "empresa"}
          {" · "}
          {formChannelLabel(endpoint.channel)}
        </p>
      </div>
      <CampaignDestinationEditor
        key={endpoint.id}
        endpoint={endpoint}
        pipelines={pipelines}
        busy={busy}
        onSave={onDestination}
      />
      {isSite ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {formUrl ? (
              <CopyButton value={formUrl} label={COPY.automacoesCopyLink} />
            ) : null}
            {embed ? (
              <CopyButton
                value={embed}
                label={COPY.automacoesCopyEmbed}
                variant="secondary"
              />
            ) : null}
          </div>
          {formUrl ? (
            <p className="truncate font-mono text-[11px] text-podium-muted">
              {formUrl}
            </p>
          ) : (
            <p className="text-[11px] text-podium-muted">
              {COPY.automacoesFormHidden}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              className="shrink-0 text-[11px] text-podium-muted underline-offset-2 hover:text-podium-gray hover:underline disabled:opacity-50"
              disabled={busy}
              onClick={onRotatePublic}
            >
              {COPY.automacoesRotatePublic}
            </button>
          </div>
        </div>
      ) : null}
      {isWebhook ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <CopyButton value={endpoint.url} label={COPY.automacoesCopyUrl} />
            {bearer ? (
              <CopyButton
                value={bearer}
                label={COPY.automacoesCopyBearer}
                variant="secondary"
              />
            ) : null}
          </div>
          <p className="truncate font-mono text-[11px] text-podium-muted">
            {endpoint.url}
          </p>
          {bearer ? (
            <p className="text-[11px] text-podium-muted">
              Guarde agora. O Grid não mostra de novo.
            </p>
          ) : (
            <p className="text-[11px] text-podium-muted">
              Chave oculta. Se perdeu, gere outra — a antiga para de funcionar.
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              className="shrink-0 text-[11px] text-podium-muted underline-offset-2 hover:text-podium-gray hover:underline disabled:opacity-50"
              disabled={busy}
              onClick={onRotate}
            >
              {COPY.automacoesRotateBearer}
            </button>
          </div>
        </div>
      ) : null}
      {isMeta ? (
        <p className="text-sm text-podium-gray">{COPY.automacoesPayloadAds}</p>
      ) : null}
      <CampaignHelp endpoint={endpoint} token={token} />
      <CampaignEvents
        endpointId={endpoint.id}
        showPayload={isWebhook}
      />
    </GlassCard>
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

function CampaignEvents({
  endpointId,
  showPayload = true,
}: {
  endpointId: string;
  showPayload?: boolean;
}) {
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
              {showPayload && inboundPayloadLine(event.payload) ? (
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
  const authorization = token ? `Bearer ${token}` : "Bearer SUA_CHAVE";
  const snippet = siteFetchSnippet(
    endpoint.url,
    authorization,
    endpoint.lead_kind,
  );

  const steps =
    endpoint.channel === "site" ? (
      <ol className="space-y-1.5 text-sm text-podium-gray">
        <li>
          <span className="font-semibold text-podium-white">1. </span>
          Copie o link ou cole o embed no site.
        </li>
        <li>
          <span className="font-semibold text-podium-white">2. </span>
          Quem preencher aparece no quadro.
        </li>
        <li>
          <span className="font-semibold text-podium-white">3. </span>
          O envio aparece em Últimos envios.
        </li>
      </ol>
    ) : endpoint.channel === "meta" ? (
      <ol className="space-y-1.5 text-sm text-podium-gray">
        <li>
          <span className="font-semibold text-podium-white">1. </span>
          Conecte a Meta API em Integrações.
        </li>
        <li>
          <span className="font-semibold text-podium-white">2. </span>
          O Formulário Instantâneo do anúncio cai no quadro sozinho.
        </li>
        <li>
          <span className="font-semibold text-podium-white">3. </span>
          Cada lead aparece em Últimos envios.
        </li>
      </ol>
    ) : (
      <div className="space-y-3">
        <ol className="space-y-1.5 text-sm text-podium-gray">
          <li>
            <span className="font-semibold text-podium-white">1. </span>
            POST no endereço desta campanha.
          </li>
          <li>
            <span className="font-semibold text-podium-white">2. </span>
            Header Authorization com o token (já vem com Bearer).
          </li>
          <li>
            <span className="font-semibold text-podium-white">3. </span>
            Body em JSON. {COPY.automacoesJsonBelow}
          </li>
        </ol>
        <details
          className="rounded-md border border-white/10 bg-black/20"
          onClick={(event) => event.stopPropagation()}
          onToggle={(event) => event.stopPropagation()}
        >
          <summary
            className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[11px] font-semibold text-podium-white [&::-webkit-details-marker]:hidden"
            onClick={(event) => event.stopPropagation()}
          >
            Exemplo de JSON
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
      </div>
    );

  return (
    <details className="group rounded-md border border-white/10 bg-white/[0.04] open:border-podium-yellow/25">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-podium-white [&::-webkit-details-marker]:hidden">
        <span>{COPY.automacoesHowItWorks}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-podium-muted transition group-open:rotate-180 group-open:text-podium-yellow" />
      </summary>
      <div className="px-3 pb-3">{steps}</div>
    </details>
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
