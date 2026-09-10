"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { IntegrationHubCard } from "@/components/integracoes/IntegrationHubCard";
import { IntegrationFocusPanel } from "@/components/integracoes/IntegrationFocusPanel";
import { IntegrationLogo } from "@/components/IntegrationLogo";
import { TestRamalButton } from "@/components/TestRamalButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  catalogAvailability,
  catalogItemsByKind,
  getCatalogItem,
  isLiveVoipId,
  isLiveDialerId,
  type IntegrationCatalogItem,
} from "@/lib/integrations/catalog";
import type {
  IntegrationConnectionPublic,
  IntegrationConnectionStatus,
  IntegrationJobRecord,
} from "@/lib/integrations/records";
import { voipSetup, type VoipField } from "@/lib/integrations/voip-setup";
import { dialerSetup, type DialerField } from "@/lib/integrations/dialer-setup";
import { CONNECTIONS_STANDBY } from "@/lib/integrations/standby";
import { COPY } from "@/lib/copy";
import { getHubItem } from "@/lib/integrations/hub";

type CreateResponse = {
  connection: IntegrationConnectionPublic;
};

export type IntegracaoKind = "voip" | "dialer";

const STATUS_BADGE: Record<
  IntegrationConnectionStatus,
  { label: string; variant: "success" | "warning" | "neutral" | "accent" }
> = {
  active: { label: "Ativa", variant: "success" },
  pending: { label: "Pendente", variant: "warning" },
  error: { label: "Erro", variant: "warning" },
  revoked: { label: "Revogada", variant: "neutral" },
};

const INPUT =
  "w-full rounded-md border border-white/10 bg-podium-panel px-2.5 py-1.5 text-xs text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

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

function CopyLine({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-2">
      <p className="min-w-0 flex-1 break-all text-[11px] text-podium-muted">
        <span className="font-semibold text-podium-gray">{label}: </span>
        {value}
      </p>
      <Button
        size="sm"
        variant="ghost"
        className="shrink-0 gap-1"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
        }}
      >
        <Copy className="h-3.5 w-3.5" />
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

function ConnectionCard({
  connection,
  lastError,
  onRemove,
  removing,
}: {
  connection: IntegrationConnectionPublic;
  lastError?: string | null;
  onRemove: () => void;
  removing: boolean;
}) {
  const item = getCatalogItem(connection.catalog_id ?? "") ??
    getCatalogItem(connection.provider);
  const status = STATUS_BADGE[connection.status];
  const nativeVoip = isLiveVoipId(connection.catalog_id ?? connection.provider);
  const nativeDialer = isLiveDialerId(connection.catalog_id ?? connection.provider);

  return (
    <GlassCard className="border-white/10 bg-white/[0.03] p-3 hover:translate-y-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-podium-white">
            {item ? <IntegrationLogo item={item} size="sm" active /> : null}
            {connection.display_name ?? connection.provider}
            <Badge variant={status.variant}>{status.label}</Badge>
          </p>
          <p className="text-xs text-podium-muted">
            {nativeVoip
              ? "VoIP nativo · token + ramal"
              : nativeDialer
                ? "Discador nativo · campanha + mailing"
                : "Webhook (legado)"}
            {connection.caller_id ? ` · ramal ${connection.caller_id}` : ""}
          </p>
          {nativeVoip || nativeDialer ? (
            <CopyLine value={connection.inbound_url} label="Inbound" />
          ) : connection.webhook_url ? (
            <p className="break-all text-[11px] text-podium-muted">
              Destino: {connection.webhook_url}
            </p>
          ) : null}
          {connection.webhook_registered ? (
            <p className="text-[11px] text-podium-success">
              {COPY.api4comWebhookOk}
            </p>
          ) : nativeVoip && connection.catalog_id === "api4com" ? (
            <p className="text-[11px] text-podium-muted">
              {COPY.api4comWebhookPending}
            </p>
          ) : nativeDialer ? (
            <p className="text-[11px] text-podium-muted">
              Tabulação HTTP nesta URL, se a 3C Plus disparar webhook. Sem Socket.io.
            </p>
          ) : null}
          {lastError ? (
            <p className="text-xs text-podium-alert">{lastError}</p>
          ) : null}
          {connection.kind === "voip" ? (
            <TestRamalButton connection={connection} />
          ) : null}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          disabled={removing}
          aria-label="Remover integração"
          className="text-podium-muted hover:text-podium-alert"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </GlassCard>
  );
}

function emptyFields(): Record<string, string> {
  return {
    token: "",
    account_sid: "",
    auth_token: "",
    caller_id: "",
    from_number: "",
    app_id: "",
    domain: "",
    api_token: "",
    campaign_id: "",
    agent_token: "",
  };
}

const PAGE = {
  voip: {
    title: "VoIP",
    lead:
      "A ligação sai na sua conta do VoIP. API4COM, Zenvia, Twilio e Telnyx conectam agora.",
    leadStandby:
      "A montagem nativa está pausada. API4COM, Zenvia, Twilio e Telnyx voltam na próxima versão.",
    empty: "Nenhum VoIP ainda. Escolha o provedor abaixo.",
    defaultId: "api4com",
  },
  dialer: {
    title: "Discador",
    lead:
      "Domínio da 3C Plus para enviar a lista ranqueada à campanha. Mega Dialer, Olos e os demais ficam para depois.",
    leadStandby: "Envio nativo de mailing fica para a próxima versão.",
    empty: "Nenhum discador ainda. Escolha a 3C Plus abaixo.",
    defaultId: "3cplus",
  },
} as const;

export function IntegracaoSetup({
  kind,
  provider,
}: {
  kind: IntegracaoKind;
  provider?: string;
}) {
  const qc = useQueryClient();
  const formRef = useRef<HTMLDivElement>(null);
  const copy = PAGE[kind];
  const catalogItems = catalogItemsByKind(kind);
  const initialId =
    provider && catalogItems.some((item) => item.id === provider)
      ? provider
      : copy.defaultId;
  const [selectedId, setSelectedId] = useState<string>(initialId);
  const [fields, setFields] = useState(emptyFields);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<IntegrationConnectionPublic | null>(null);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);

  const selected = getCatalogItem(selectedId) ?? getCatalogItem(copy.defaultId)!;
  const setup = kind === "voip" ? voipSetup(selected.id) : null;
  const dialer = kind === "dialer" ? dialerSetup(selected.id) : null;
  const live = catalogAvailability(selected) === "live";

  const list = useQuery({
    queryKey: ["integration-connections"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/connections");
      if (!res.ok) throw new Error("Não foi possível carregar");
      return (await res.json()) as {
        connections: IntegrationConnectionPublic[];
      };
    },
  });

  const jobs = useQuery({
    queryKey: ["integration-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/jobs");
      if (!res.ok) throw new Error("Não foi possível carregar");
      return (await res.json()) as { jobs: IntegrationJobRecord[] };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (dialer) {
        const credentials: Record<string, string> = {};
        if (fields.api_token.trim()) credentials.api_token = fields.api_token.trim();
        if (fields.agent_token.trim()) credentials.agent_token = fields.agent_token.trim();
        const res = await fetch("/api/integrations/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            catalog_id: selected.id,
            caller_id: fields.caller_id || undefined,
            domain: fields.domain,
            campaign_id: fields.campaign_id,
            credentials,
          }),
        });
        const body = (await res.json()) as CreateResponse & {
          error?: string;
          campaigns?: Array<{ id: string; name: string }>;
        };
        if (!res.ok) {
          if (body.campaigns?.length) setCampaigns(body.campaigns);
          throw new Error(body.error ?? "Não foi possível conectar");
        }
        return body;
      }
      if (!setup) throw new Error("Escolha um VoIP disponível");
      const credentials: Record<string, string> = {};
      for (const field of setup.fields) {
        if (field.id === "caller_id" || field.id === "from_number" || field.id === "app_id") {
          continue;
        }
        const value = fields[field.id]?.trim() ?? "";
        if (value) credentials[field.id] = value;
      }
      const res = await fetch("/api/integrations/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalog_id: selected.id,
          caller_id: fields.caller_id,
          from_number: fields.from_number || undefined,
          app_id: fields.app_id || undefined,
          credentials,
        }),
      });
      const body = (await res.json()) as CreateResponse & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Não foi possível conectar");
      return body;
    },
    onSuccess: (data) => {
      setCreated(data.connection);
      setFields(emptyFields());
      setCampaigns([]);
      setError(null);
      void qc.invalidateQueries({ queryKey: ["integration-connections"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const loadCampaigns = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/integrations/3cplus/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: fields.domain,
          api_token: fields.api_token,
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        campaigns?: Array<{ id: string; name: string }>;
      };
      if (!res.ok) throw new Error(body.error ?? "Não foi possível listar campanhas");
      return body.campaigns ?? [];
    },
    onSuccess: (rows) => {
      setCampaigns(rows);
      setError(null);
      if (rows.length === 1) {
        setFields((prev) => ({ ...prev, campaign_id: rows[0]!.id }));
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/integrations/connections/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Não foi possível remover");
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["integration-connections"] }),
  });

  const connections = (list.data?.connections ?? []).filter((c) => c.kind === kind);
  const sortedConnections = useMemo(
    () =>
      [...connections].sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (b.status === "active" && a.status !== "active") return 1;
        return 0;
      }),
    [connections],
  );

  const lastErrorByConnection = useMemo(() => {
    const map = new Map<string, string>();
    for (const job of jobs.data?.jobs ?? []) {
      if (job.status !== "failed" || !job.last_error) continue;
      if (!map.has(job.connection_id)) map.set(job.connection_id, job.last_error);
    }
    return map;
  }, [jobs.data?.jobs]);

  function pickTool(item: IntegrationCatalogItem) {
    if (catalogAvailability(item) !== "live") return;
    setSelectedId(item.id);
    setFields(emptyFields());
    setCampaigns([]);
    setError(null);
    setCreated(null);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  useEffect(() => {
    setSelectedId(initialId);
    setFields(emptyFields());
    setCampaigns([]);
    setError(null);
    setCreated(null);
  }, [initialId]);

  const canSubmitVoip =
    live &&
    Boolean(setup) &&
    Boolean(fields.caller_id.trim()) &&
    (setup?.fields ?? []).every((field) => {
      if (field.id === "caller_id") return true;
      if (field.id === "from_number" || field.id === "app_id") {
        return Boolean(fields[field.id]?.trim());
      }
      return Boolean(fields[field.id]?.trim());
    });
  const canSubmitDialer =
    live &&
    Boolean(dialer) &&
    Boolean(fields.domain.trim()) &&
    Boolean(fields.api_token.trim()) &&
    Boolean(fields.campaign_id.trim());
  const canSubmit = kind === "dialer" ? canSubmitDialer : canSubmitVoip;
  const selectedConnections = sortedConnections.filter(
    (connection) => (connection.catalog_id ?? connection.provider) === selected.id,
  );

  return (
    <div className="space-y-6">
      {CONNECTIONS_STANDBY ? (
        <p
          role="status"
          className="text-pretty rounded-md border border-podium-yellow/30 bg-podium-yellow/10 px-3 py-2 text-xs text-podium-yellow"
        >
          {COPY.conexoesStandbyBanner}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {catalogItems.map((item) => {
          const hub = getHubItem(item.id);
          if (!hub) return null;
          const n = connections.filter(
            (connection) =>
              (connection.catalog_id ?? connection.provider) === item.id &&
              connection.status === "active",
          ).length;
          const status =
            catalogAvailability(item) === "soon" || CONNECTIONS_STANDBY
              ? COPY.integracoesStatusSoon
              : n > 0
                ? item.kind === "dialer"
                  ? COPY.integracoesStatusConnected
                  : n === 1
                    ? COPY.integracoesStatusVoipOne
                    : COPY.integracoesStatusVoipMany.replace("{n}", String(n))
                : COPY.integracoesStatusNone;
          return (
            <IntegrationHubCard
              key={item.id}
              item={{
                ...hub,
                availability:
                  CONNECTIONS_STANDBY || catalogAvailability(item) === "soon"
                    ? "soon"
                    : "live",
                href:
                  CONNECTIONS_STANDBY || catalogAvailability(item) === "soon"
                    ? null
                    : hub.href,
              }}
              status={status}
              selected={selectedId === item.id}
              onSelect={
                catalogAvailability(item) === "live" && !CONNECTIONS_STANDBY
                  ? () => pickTool(item)
                  : undefined
              }
            />
          );
        })}
      </div>

      <div ref={formRef}>
        <IntegrationFocusPanel
          help={
            <ol className="space-y-1.5">
              {CONNECTIONS_STANDBY ? (
                <>
                  <li>A ligação pela internet ainda não está nesta versão.</li>
                  <li>Ligar na ficha abre o telefone do aparelho.</li>
                </>
              ) : kind === "dialer" ? (
                <>
                  <li>Cole o domínio da 3C Plus, o token de gestor e a campanha.</li>
                  <li>O GRID valida na hora. Se o token for recusado, nada é salvo.</li>
                  <li>Envie a lista no Grid. Ligar na ficha usa o token de agente.</li>
                </>
              ) : selected.id === "api4com" ? (
                <>
                  <li>{COPY.api4comStep1}</li>
                  <li>{COPY.api4comStep2}</li>
                  <li>{COPY.api4comStep3}</li>
                </>
              ) : (
                <>
                  <li>Cole o token do VoIP e o ramal.</li>
                  <li>O GRID valida na hora. Se o token for recusado, nada é salvo.</li>
                  <li>Testar ligação toca o Webphone. Na ficha, Ligar dispara a chamada.</li>
                </>
              )}
            </ol>
          }
        >
          <div className="flex items-center gap-3">
            <IntegrationLogo item={selected} size="lg" active />
            <div>
              <p className="text-sm font-semibold text-podium-white">
                Conectar {selected.name}
              </p>
              <p className="text-[11px] text-podium-muted">
                {CONNECTIONS_STANDBY
                  ? COPY.integracoesStatusSoon
                  : live && dialer
                    ? "Domínio + token de gestor + campanha"
                    : live && setup
                      ? selected.id === "api4com"
                        ? COPY.api4comConnectHint
                        : "Token + ramal · teste na hora"
                      : COPY.integracoesStatusSoon}
              </p>
            </div>
          </div>
          {selectedConnections.length > 0 ? (
            <div className="space-y-3">
              {selectedConnections.map((connection) => (
                <ConnectionCard
                  key={connection.id}
                  connection={connection}
                  lastError={lastErrorByConnection.get(connection.id)}
                  removing={remove.isPending}
                  onRemove={() => remove.mutate(connection.id)}
                />
              ))}
            </div>
          ) : null}
          {CONNECTIONS_STANDBY ? (
            <p className="text-sm text-podium-muted">{COPY.conexoesStandbyForm}</p>
          ) : live && dialer ? (
            <>
              {dialer.fields.map((field: DialerField) => (
                <Field key={field.id} label={field.label}>
                  {field.id === "campaign_id" && campaigns.length > 0 ? (
                    <Select
                      value={fields.campaign_id}
                      onChange={(campaign_id) =>
                        setFields((prev) => ({ ...prev, campaign_id }))
                      }
                      placeholder="Escolha a campanha"
                      className="w-full"
                      options={[
                        { value: "", label: "Escolha a campanha" },
                        ...campaigns.map((campaign) => ({
                          value: campaign.id,
                          label: campaign.name,
                        })),
                      ]}
                    />
                  ) : (
                    <input
                      value={fields[field.id] ?? ""}
                      onChange={(e) =>
                        setFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      type={field.secret ? "password" : "text"}
                      autoComplete="off"
                      className={INPUT}
                    />
                  )}
                  {field.hint ? <Hint className="mt-1.5">{field.hint}</Hint> : null}
                </Field>
              ))}
              <Button
                variant="secondary"
                disabled={
                  !fields.domain.trim() ||
                  !fields.api_token.trim() ||
                  loadCampaigns.isPending
                }
                onClick={() => loadCampaigns.mutate()}
              >
                {loadCampaigns.isPending ? "Buscando…" : "Buscar campanhas"}
              </Button>
              {error ? <p className="text-sm text-podium-alert">{error}</p> : null}
              <Button
                variant="primary"
                disabled={!canSubmit || create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? "Validando token…" : `Conectar ${selected.name}`}
              </Button>
              <Hint>{dialer.inboundHint}</Hint>
            </>
          ) : live && setup ? (
            <>
              {setup.fields.map((field: VoipField) => (
                <Field key={field.id} label={field.label}>
                  <input
                    value={fields[field.id] ?? ""}
                    onChange={(e) =>
                      setFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    type={field.secret ? "password" : "text"}
                    autoComplete="off"
                    className={INPUT}
                  />
                  {field.hint ? <Hint className="mt-1.5">{field.hint}</Hint> : null}
                </Field>
              ))}
              {error ? <p className="text-sm text-podium-alert">{error}</p> : null}
              <Button
                variant="primary"
                disabled={!canSubmit || create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? "Validando token…" : `Conectar ${selected.name}`}
              </Button>
              <Hint>{setup.inboundHint}</Hint>
            </>
          ) : (
            <p className="text-sm text-podium-muted">
              Este PBX precisa de um conector na rede local. Ainda não está nesta
              versão.
            </p>
          )}
          {created ? (
            <div className="space-y-3 rounded-md border border-podium-yellow/20 bg-podium-yellow/5 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-podium-yellow">
                <Check className="h-4 w-4" />
                {created.kind === "dialer"
                  ? "Token aceito. Envie a lista no Grid."
                  : "Token aceito. Teste a ligação."}
              </p>
              <CopyLine value={created.inbound_url} label="URL de entrada" />
              {created.webhook_registered ? (
                <p className="text-xs text-podium-success">
                  {COPY.api4comWebhookOk}
                </p>
              ) : created.catalog_id === "api4com" ? (
                <p className="text-xs text-podium-muted">
                  {COPY.api4comWebhookPending}
                </p>
              ) : null}
              {created.kind === "voip" ? (
                <TestRamalButton connection={created} />
              ) : (
                <p className="text-xs text-podium-muted">
                  Envie a lista no Grid. Ligar na ficha usa o token de agente, com o
                  ramal logado na campanha.
                </p>
              )}
            </div>
          ) : null}
        </IntegrationFocusPanel>
      </div>
    </div>
  );
}
