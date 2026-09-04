"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { IntegrationLogo } from "@/components/IntegrationLogo";
import { SectionTitle } from "@/components/SectionTitle";
import { TestRamalButton } from "@/components/TestRamalButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BACK } from "@/lib/back";
import {
  catalogAvailability,
  catalogItemsByKind,
  getCatalogItem,
  isLiveVoipId,
  type IntegrationCatalogItem,
} from "@/lib/integrations/catalog";
import type {
  IntegrationConnectionPublic,
  IntegrationConnectionStatus,
  IntegrationJobRecord,
} from "@/lib/integrations/records";
import { voipSetup, type VoipField } from "@/lib/integrations/voip-setup";
import { CONNECTIONS_STANDBY } from "@/lib/integrations/standby";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

type CreateResponse = {
  connection: IntegrationConnectionPublic;
};

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
  "w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 text-sm text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

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
  const native = isLiveVoipId(connection.catalog_id ?? connection.provider);

  return (
    <GlassCard className="border-white/10 bg-white/[0.03] p-4 hover:translate-y-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-podium-white">
            {item ? <IntegrationLogo item={item} size="sm" active /> : null}
            {connection.display_name ?? connection.provider}
            <Badge variant={status.variant}>{status.label}</Badge>
          </p>
          <p className="text-xs text-podium-muted">
            {native ? "VoIP nativo · token + ramal" : "Webhook (legado)"}
            {connection.caller_id ? ` · ramal ${connection.caller_id}` : ""}
          </p>
          {native ? (
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
          ) : native && connection.catalog_id === "api4com" ? (
            <p className="text-[11px] text-podium-muted">
              Cole a URL inbound em Integrações → Webhook se o registro automático não rodou.
            </p>
          ) : null}
          {lastError ? (
            <p className="text-xs text-podium-alert">{lastError}</p>
          ) : null}
          {connection.kind !== "crm" ? (
            <TestRamalButton connection={connection} />
          ) : null}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          disabled={removing}
          aria-label="Remover conexão"
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
  };
}

function ConexoesInner() {
  const qc = useQueryClient();
  const formRef = useRef<HTMLDivElement>(null);
  const kindFromUrl = useSearchParams().get("kind");
  const [selectedId, setSelectedId] = useState("api4com");
  const [fields, setFields] = useState(emptyFields);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<IntegrationConnectionPublic | null>(null);

  const selected = getCatalogItem(selectedId) ?? getCatalogItem("api4com")!;
  const setup = voipSetup(selected.id);
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
      setError(null);
      void qc.invalidateQueries({ queryKey: ["integration-connections"] });
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

  const connections = list.data?.connections ?? [];
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
    setError(null);
    setCreated(null);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  useEffect(() => {
    if (kindFromUrl !== "voip" && kindFromUrl !== "crm" && kindFromUrl !== "dialer") {
      return;
    }
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [kindFromUrl]);

  const voipItems = catalogItemsByKind("voip");
  const canSubmit =
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

  return (
    <AppShell title="Conexões" back={BACK.painel}>
      <SectionTitle>Conexões VoIP</SectionTitle>
      {CONNECTIONS_STANDBY ? (
        <p
          role="status"
          className="mt-3 max-w-2xl text-pretty rounded-xl border border-podium-yellow/30 bg-podium-yellow/10 px-4 py-3 text-sm text-podium-yellow"
        >
          {COPY.conexoesStandbyBanner}
        </p>
      ) : (
        <p className="mt-2 max-w-2xl text-pretty text-sm text-podium-muted">
          Cole o token e o ramal. O GRID disca ao clicar em Ligar. Conectar CRM e
          discador externos ainda não está nesta versão.
        </p>
      )}
      {kindFromUrl === "crm" || kindFromUrl === "dialer" ? (
        <p className="mt-3 max-w-2xl text-pretty text-sm text-podium-yellow">
          {kindFromUrl === "crm" ? "CRM" : "Discador"} ainda não conecta nativo.
          Por agora, ligue um VoIP para discar da ficha.
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
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
                <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
              ) : sortedConnections.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-sm text-podium-muted">
                  {CONNECTIONS_STANDBY
                    ? COPY.conexoesStandbyEmpty
                    : "Nenhuma conexão ainda. Escolha o VoIP e cole o token."}
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
              VoIP
            </h3>
            <p className="mt-1 text-sm text-podium-gray">
              {CONNECTIONS_STANDBY
                ? "A montagem nativa está pausada. API4COM, Zenvia, Twilio e Telnyx voltam na próxima versão."
                : "API4COM, Zenvia, Twilio e Telnyx conectam agora. Asterisk, 3CX e Issabel ficam para um conector na rede local."}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
              {voipItems.map((item) => {
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
                      "group relative flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition",
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
            className="max-w-xl space-y-4 border-white/10 bg-white/[0.03] p-5 hover:translate-y-0"
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
                    : live
                      ? "Token + ramal · teste na hora"
                      : "Em breve"}
                </p>
              </div>
            </div>
            {CONNECTIONS_STANDBY ? (
              <p className="text-sm text-podium-muted">{COPY.conexoesStandbyForm}</p>
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
            <GlassCard className="max-w-xl space-y-3 border-white/10 bg-white/[0.03] p-5 hover:translate-y-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-podium-yellow">
                <Check className="h-4 w-4" />
                Token aceito. Teste a ligação.
              </p>
              <CopyLine value={created.inbound_url} label="URL de entrada" />
              {created.webhook_registered ? (
                <p className="text-xs text-podium-success">
                  Webhook já apontado na API4COM.
                </p>
              ) : null}
              <TestRamalButton connection={created} />
            </GlassCard>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <GlassCard className="border-white/10 bg-white/[0.03] p-5 hover:translate-y-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-muted">
              Como funciona
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-relaxed text-podium-gray">
              {CONNECTIONS_STANDBY ? (
                <>
                  <li>A ligação pela internet ainda não está nesta versão.</li>
                  <li>Ligar na ficha abre o telefone do aparelho.</li>
                  <li>Quando a montagem voltar, você cola o token e o ramal aqui.</li>
                </>
              ) : (
                <>
                  <li>Cole o token do painel do VoIP e o ramal (ou seu número).</li>
                  <li>O GRID valida na hora. Se o token for recusado, nada é salvo.</li>
                  <li>Testar ligação toca o Webphone / seu celular.</li>
                  <li>Na ficha, Ligar dispara a chamada. Quando a chamada cai, o status volta para o lead.</li>
                </>
              )}
            </ol>
          </GlassCard>
        </aside>
      </div>
    </AppShell>
  );
}

export default function ConexoesPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Conexões" back={BACK.painel}>
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
        </AppShell>
      }
    >
      <ConexoesInner />
    </Suspense>
  );
}
