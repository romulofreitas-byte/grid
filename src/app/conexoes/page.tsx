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
  CATALOG_SECTIONS,
  catalogItemsByKind,
  catalogKindLabel,
  firstCatalogIdForKind,
  getCatalogItem,
  parseConexoesKind,
  resolveCatalogItem,
  type IntegrationCatalogItem,
} from "@/lib/integrations/catalog";
import type {
  IntegrationConnectionPublic,
  IntegrationConnectionStatus,
} from "@/lib/integrations/records";
import { cn } from "@/lib/utils";

type CreateResponse = {
  connection: IntegrationConnectionPublic;
  webhook_secret: string;
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

const KIND_JOB: Record<string, string> = {
  crm: "Recebe a lista do Grid (evento list.exported).",
  dialer: "Dispara ligação no clique (evento call.originated).",
  voip: "Dispara ligação no clique (evento call.originated).",
  webhook: "Ponte genérica — lista e/ou ligação, conforme o fluxo no Make/Zapier/n8n.",
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

const INPUT =
  "w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 text-sm text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

function SetupChecklist({
  connections,
}: {
  connections: IntegrationConnectionPublic[];
}) {
  const active = connections.filter((c) => c.status === "active");
  const hasCrm = active.some((c) => c.kind === "crm");
  const hasCall = active.some((c) => c.kind === "dialer" || c.kind === "voip");
  const hasBridge = active.some(
    (c) => c.kind === "webhook" || c.catalog_id === "make" || c.catalog_id === "zapier" || c.catalog_id === "n8n",
  );

  const items = [
    {
      ok: hasCrm,
      title: "CRM ou destino de lista",
      hint: "Para o botão Enviar do Grid",
    },
    {
      ok: hasCall,
      title: "Discador ou VoIP",
      hint: "Para Ligar na ficha / grid",
    },
    {
      ok: hasBridge || (hasCrm && hasCall),
      title: "Ponte (Make / Zapier / n8n) — opcional",
      hint: "Útil se o CRM/discador não expõe webhook direto",
    },
  ];

  return (
    <GlassCard className="mt-6 border-white/10 bg-white/[0.03] p-4 hover:translate-y-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-muted">
        Checklist comercial
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.title}
            className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5"
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                item.ok
                  ? "border-podium-success/40 bg-podium-success/15 text-podium-success"
                  : "border-white/15 text-transparent",
              )}
              aria-hidden
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-podium-white">
                {item.title}
              </span>
              <span className="text-xs text-podium-muted">{item.hint}</span>
            </span>
            <Badge
              variant={item.ok ? "success" : "neutral"}
              className="ml-auto shrink-0"
            >
              {item.ok ? "ok" : "falta"}
            </Badge>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

function PayloadGuide() {
  return (
    <GlassCard className="border-white/10 bg-white/[0.03] p-5 hover:translate-y-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-muted">
        O que o GRID envia
      </p>
      <p className="mt-2 text-sm text-podium-gray">
        Toda conexão hoje é{" "}
        <span className="font-semibold text-podium-white">
          webhook HTTPS + HMAC
        </span>{" "}
        — não há OAuth nativo com HubSpot, 3C etc. O logo só identifica o
        destino; o transporte é o mesmo.
      </p>
      <div className="mt-4 space-y-3 text-xs leading-relaxed text-podium-muted">
        <div className="rounded-xl border border-white/10 px-3 py-2.5">
          <p className="font-semibold text-podium-white">list.exported</p>
          <p className="mt-1">
            Grid → Enviar. Corpo JSON com leads; assinatura HMAC no header. Consome o
            mesmo crédito do Excel (uma vez por CNPJ).
          </p>
        </div>
        <div className="rounded-xl border border-white/10 px-3 py-2.5">
          <p className="font-semibold text-podium-white">call.originated</p>
          <p className="mt-1">
            Clique em Ligar. Payload com CNPJ e número E.164. Grátis. Discador/VoIP
            precisam de ramal (caller id) para teste.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 px-3 py-2.5">
          <p className="font-semibold text-podium-white">Tabulação de volta</p>
          <p className="mt-1">
            POST no inbound URL com o mesmo segredo HMAC para atualizar status do
            lead.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

function ConnectionCard({
  connection,
  onRemove,
  removing,
}: {
  connection: IntegrationConnectionPublic;
  onRemove: () => void;
  removing: boolean;
}) {
  const item = resolveCatalogItem(
    connection.catalog_id,
    connection.display_name,
  );
  const status = STATUS_BADGE[connection.status];

  return (
    <GlassCard className="border-white/10 bg-white/[0.03] p-4 hover:translate-y-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-podium-white">
            {item ? <IntegrationLogo item={item} size="sm" active /> : null}
            {connection.display_name ?? connection.provider}
            <Badge variant={status.variant}>{status.label}</Badge>
          </p>
          <p className="mt-1 text-xs text-podium-muted">
            {catalogKindLabel(connection.kind)} · webhook HTTPS · provider{" "}
            {connection.provider}
          </p>
          <p className="mt-2 text-xs text-podium-gray">
            {KIND_JOB[connection.kind] ?? KIND_JOB.webhook}
          </p>
          {connection.webhook_url ? (
            <p className="mt-2 break-all text-[11px] text-podium-muted">
              Destino: {connection.webhook_url}
            </p>
          ) : null}
          <p className="mt-1 break-all text-[11px] text-podium-muted">
            Inbound: {connection.inbound_url}
          </p>
          {connection.kind !== "crm" ? (
            <div className="mt-3">
              <TestRamalButton connection={connection} />
            </div>
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

function ConexoesInner() {
  const qc = useQueryClient();
  const formRef = useRef<HTMLDivElement>(null);
  const kindFromUrl = parseConexoesKind(useSearchParams().get("kind"));
  const [selectedId, setSelectedId] = useState(
    kindFromUrl ? firstCatalogIdForKind(kindFromUrl) : "webhook",
  );
  const [url, setUrl] = useState("");
  const [name, setName] = useState("Webhook");
  const [callerId, setCallerId] = useState("");
  const [secretOnce, setSecretOnce] = useState<string | null>(null);
  const [created, setCreated] = useState<IntegrationConnectionPublic | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const selected = getCatalogItem(selectedId) ?? getCatalogItem("webhook")!;
  const customName = selected.id === "webhook";

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

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/integrations/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalog_id: selected.id,
          kind: selected.kind,
          display_name: customName ? name : selected.name,
          webhook_url: url,
          caller_id: callerId || undefined,
        }),
      });
      const body = (await res.json()) as CreateResponse & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Não foi possível conectar");
      return body;
    },
    onSuccess: (data) => {
      setSecretOnce(data.webhook_secret);
      setCreated(data.connection);
      setUrl("");
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

  function pickTool(item: IntegrationCatalogItem) {
    setSelectedId(item.id);
    setName(item.id === "webhook" ? "Webhook" : item.name);
    setError(null);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  useEffect(() => {
    if (!kindFromUrl) return;
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [kindFromUrl]);

  return (
    <AppShell title="Conexões" back={BACK.box}>
      <SectionTitle>Conexões</SectionTitle>
      <p className="mt-2 max-w-2xl text-sm text-podium-muted">
        Cole a URL HTTPS do destino. O GRID assina com HMAC e envia JSON — o
        catálogo de logos é só rótulo comercial, não integração OAuth.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          <SetupChecklist connections={connections} />

          <section>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-podium-muted">
                  Conectadas de verdade
                </h3>
                <p className="mt-1 text-sm text-podium-gray">
                  Só aparece aqui o que você já cadastrou com URL.
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
                  Nenhuma conexão ainda. Escolha um destino no catálogo e cole a
                  URL.
                </p>
              ) : (
                sortedConnections.map((c) => (
                  <ConnectionCard
                    key={c.id}
                    connection={c}
                    removing={remove.isPending}
                    onRemove={() => remove.mutate(c.id)}
                  />
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-podium-muted">
              Catálogo (rótulo)
            </h3>
            <p className="mt-1 text-sm text-podium-gray">
              Escolha o nome que aparece na conexão. O envio continua sendo
              webhook.
            </p>
            <div className="mt-4 space-y-6">
              {CATALOG_SECTIONS.map((section) => (
                <div key={section.kind}>
                  <p className="mb-2 text-xs font-semibold text-podium-white">
                    {section.label}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                    {catalogItemsByKind(section.kind).map((item) => {
                      const on = selectedId === item.id;
                      const already = connections.some(
                        (c) =>
                          c.catalog_id === item.id && c.status === "active",
                      );
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => pickTool(item)}
                          className={cn(
                            "group relative flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition",
                            on
                              ? "border-white/25 bg-white/[0.07]"
                              : "border-white/10 bg-white/[0.03] hover:border-white/20",
                          )}
                        >
                          {already ? (
                            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-podium-success" />
                          ) : null}
                          <IntegrationLogo item={item} active={on} />
                          <span
                            className={cn(
                              "text-[11px] font-semibold leading-tight",
                              on ? "text-podium-white" : "text-podium-gray",
                            )}
                          >
                            {item.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
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
                  {catalogKindLabel(selected.kind)} · webhook HTTPS + HMAC
                </p>
              </div>
            </div>
            <p className="text-xs text-podium-gray">
              {KIND_JOB[selected.kind] ?? KIND_JOB.webhook}
            </p>
            {customName ? (
              <Field label="Nome">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={INPUT}
                />
              </Field>
            ) : null}
            <Field label="URL de destino (HTTPS)">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hooks.exemplo.com/grid"
                className={INPUT}
              />
            </Field>
            <Field label="Ramal / número de origem (opcional — discador/VoIP)">
              <input
                value={callerId}
                onChange={(e) => setCallerId(e.target.value)}
                placeholder="1001"
                className={INPUT}
              />
            </Field>
            {error ? <p className="text-sm text-podium-alert">{error}</p> : null}
            <Button
              variant="primary"
              disabled={!url.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending
                ? "Conectando…"
                : `Conectar ${selected.id === "webhook" ? "webhook" : selected.name}`}
            </Button>
            <Hint>
              O segredo HMAC aparece uma vez. Use o mesmo para assinar a
              tabulação de volta.
            </Hint>
          </GlassCard>

          {secretOnce ? (
            <GlassCard className="max-w-xl space-y-3 border-white/10 bg-white/[0.03] p-5 hover:translate-y-0">
              <p className="text-sm font-semibold text-podium-yellow">
                Guarde o segredo agora
              </p>
              <code className="block break-all rounded-xl bg-black/40 p-3 text-xs">
                {secretOnce}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void navigator.clipboard.writeText(secretOnce)}
                className="gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </Button>
              {created && created.kind !== "crm" ? (
                <TestRamalButton connection={created} />
              ) : null}
            </GlassCard>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <PayloadGuide />
        </aside>
      </div>
    </AppShell>
  );
}

export default function ConexoesPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Conexões" back={BACK.box}>
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
        </AppShell>
      }
    >
      <ConexoesInner />
    </Suspense>
  );
}
