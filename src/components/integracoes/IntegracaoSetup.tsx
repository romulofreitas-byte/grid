"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Check, Copy, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
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
import { planHasFeature } from "@/lib/billing/catalog";
import { COPY } from "@/lib/copy";
import { useBillingMe } from "@/hooks/useBillingMe";
import { cn } from "@/lib/utils";

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
              Webhook registrado no painel da API4COM.
            </p>
          ) : nativeVoip && connection.catalog_id === "api4com" ? (
            <p className="text-[11px] text-podium-muted">
              Cole a URL inbound em Integrações se o registro automático não rodou.
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
      "Cole o token do VoIP para ligar da ficha. API4COM, Zenvia, Twilio e Telnyx conectam agora.",
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

export function IntegracaoSetup({ kind }: { kind: IntegracaoKind }) {
  const qc = useQueryClient();
  const billing = useBillingMe();
  const formRef = useRef<HTMLDivElement>(null);
  const copy = PAGE[kind];
  const [selectedId, setSelectedId] = useState<string>(copy.defaultId);
  const [fields, setFields] = useState(emptyFields);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<IntegrationConnectionPublic | null>(null);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);

  const selected = getCatalogItem(selectedId) ?? getCatalogItem(copy.defaultId)!;
  const setup = kind === "voip" ? voipSetup(selected.id) : null;
  const dialer = kind === "dialer" ? dialerSetup(selected.id) : null;
  const live = catalogAvailability(selected) === "live";
  const catalogItems = catalogItemsByKind(kind);

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
    setSelectedId(copy.defaultId);
    setFields(emptyFields());
    setCampaigns([]);
    setError(null);
    setCreated(null);
  }, [copy.defaultId]);

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

  return (
    <>
      {CONNECTIONS_STANDBY ? (
        <p
          role="status"
          className="mt-3 text-pretty rounded-md border border-podium-yellow/30 bg-podium-yellow/10 px-3 py-2 text-xs text-podium-yellow"
        >
          {COPY.conexoesStandbyBanner}
        </p>
      ) : (
        <p className="mt-2 max-w-3xl text-pretty text-sm text-podium-muted">
          {copy.lead}
        </p>
      )}
      {planHasFeature(billing.data?.balance.plano, "automations") ? (
        <p className="mt-3 max-w-3xl text-pretty text-sm text-podium-gray">
          {COPY.conexoesInboundHint}{" "}
          <Link href="/integracoes" className="font-semibold text-podium-yellow">
            Abrir Integrações
          </Link>
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          <section>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-podium-muted">
                  Conectadas
                </h3>
                <p className="mt-1 text-sm text-podium-gray">
                  Só aparece aqui o que já passou no teste de token.
                </p>
              </div>
              <Badge variant="neutral">
                {connections.filter((c) => c.status === "active").length} ativas
              </Badge>
            </div>
            <div className="mt-3 space-y-3">
              {list.isLoading ? (
                <div className="h-16 animate-pulse rounded-md bg-white/5" />
              ) : sortedConnections.length === 0 ? (
                <p className="rounded-md border border-dashed border-white/15 px-3 py-4 text-xs text-podium-muted">
                  {CONNECTIONS_STANDBY ? COPY.conexoesStandbyEmpty : copy.empty}
                </p>
              ) : (
                sortedConnections.map((c) => (
                  <ConnectionCard
                    key={c.id}
                    connection={c}
                    lastError={lastErrorByConnection.get(c.id)}
                    removing={remove.isPending}
                    onRemove={() => remove.mutate(c.id)}
                  />
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-podium-muted">
              {copy.title}
            </h3>
            <p className="mt-1 text-sm text-podium-gray">
              {CONNECTIONS_STANDBY ? copy.leadStandby : copy.lead}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
              {catalogItems.map((item) => {
                const on = selectedId === item.id;
                const available =
                  catalogAvailability(item) === "live" && !CONNECTIONS_STANDBY;
                const already = connections.some(
                  (c) => c.catalog_id === item.id && c.status === "active",
                );
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={on}
                    disabled={!available}
                    onClick={() => pickTool(item)}
                    className={cn(
                      "group relative flex flex-col items-center gap-2 rounded-md border px-2 py-2 text-center transition",
                      !available
                        ? "cursor-not-allowed border-white/5 bg-white/[0.015] opacity-55"
                        : on
                          ? "border-white/25 bg-white/[0.07]"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20",
                    )}
                  >
                    {already ? (
                      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-podium-success" />
                    ) : null}
                    <IntegrationLogo item={item} active={on && available} />
                    <span
                      className={cn(
                        "text-[11px] font-semibold leading-tight",
                        on && available ? "text-podium-white" : "text-podium-gray",
                      )}
                    >
                      {item.name}
                    </span>
                    {!available ? (
                      <span className="text-[9px] uppercase tracking-wide text-podium-muted">
                        Em breve
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <GlassCard
            className="space-y-3 border-white/10 bg-white/[0.03] p-3 hover:translate-y-0"
            highlight
          >
            <div ref={formRef} className="flex items-center gap-3">
              <IntegrationLogo item={selected} active />
              <div>
                <p className="text-sm font-semibold text-podium-white">
                  Conectar {selected.name}
                </p>
                <p className="text-[11px] text-podium-muted">
                  {CONNECTIONS_STANDBY
                    ? "Em breve"
                    : live && dialer
                      ? "Domínio + token de gestor + campanha"
                      : live && setup
                        ? "Token + ramal · teste na hora"
                        : "Em breve"}
                </p>
              </div>
            </div>
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
          </GlassCard>

          {created ? (
            <GlassCard className="space-y-3 border-white/10 bg-white/[0.03] p-3 hover:translate-y-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-podium-yellow">
                <Check className="h-4 w-4" />
                {created.kind === "dialer"
                  ? "Token aceito. Envie a lista no Grid."
                  : "Token aceito. Teste a ligação."}
              </p>
              <CopyLine value={created.inbound_url} label="URL de entrada" />
              {created.webhook_registered ? (
                <p className="text-xs text-podium-success">
                  Webhook já apontado na API4COM.
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
            </GlassCard>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <GlassCard className="border-white/10 bg-white/[0.03] p-3 hover:translate-y-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
              Como funciona
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-relaxed text-podium-gray">
              {CONNECTIONS_STANDBY ? (
                <>
                  <li>A ligação pela internet ainda não está nesta versão.</li>
                  <li>Ligar na ficha abre o telefone do aparelho.</li>
                  <li>Quando a montagem voltar, você cola o token e o ramal aqui.</li>
                </>
              ) : kind === "dialer" ? (
                <>
                  <li>Cole o domínio da 3C Plus, o token de gestor e a campanha.</li>
                  <li>O GRID valida na hora. Se o token for recusado, nada é salvo.</li>
                  <li>Envie a lista no Grid. Ligar na ficha usa o token de agente.</li>
                </>
              ) : (
                <>
                  <li>Cole o token do VoIP e o ramal.</li>
                  <li>O GRID valida na hora. Se o token for recusado, nada é salvo.</li>
                  <li>Testar ligação toca o Webphone. Na ficha, Ligar dispara a chamada.</li>
                </>
              )}
            </ol>
          </GlassCard>
        </aside>
      </div>
    </>
  );
}
