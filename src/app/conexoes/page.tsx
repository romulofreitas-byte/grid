"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { IntegrationLogo } from "@/components/IntegrationLogo";
import { SectionTitle } from "@/components/SectionTitle";
import { TestRamalButton } from "@/components/TestRamalButton";
import { BACK } from "@/lib/back";
import {
  CATALOG_SECTIONS,
  catalogItemsByKind,
  catalogKindLabel,
  getCatalogItem,
  resolveCatalogItem,
  type IntegrationCatalogItem,
} from "@/lib/integrations/catalog";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";
import { cn } from "@/lib/utils";

type CreateResponse = {
  connection: IntegrationConnectionPublic;
  webhook_secret: string;
};

export default function ConexoesPage() {
  const qc = useQueryClient();
  const formRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState("webhook");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("Webhook");
  const [callerId, setCallerId] = useState("");
  const [secretOnce, setSecretOnce] = useState<string | null>(null);
  const [created, setCreated] = useState<IntegrationConnectionPublic | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = getCatalogItem(selectedId) ?? getCatalogItem("webhook")!;
  const customName = selected.id === "webhook";

  const list = useQuery({
    queryKey: ["integration-connections"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/connections");
      if (!res.ok) throw new Error("Não foi possível carregar");
      return (await res.json()) as { connections: IntegrationConnectionPublic[] };
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration-connections"] }),
  });

  const connections = list.data?.connections ?? [];

  function pickTool(item: IntegrationCatalogItem) {
    setSelectedId(item.id);
    setName(item.id === "webhook" ? "Webhook" : item.name);
    setError(null);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  return (
    <AppShell title="Conexões" back={BACK.box}>
      <SectionTitle>Conexões</SectionTitle>
      <p className="mt-2 max-w-2xl text-sm text-podium-muted">
        Escolha o que você já usa. A lista e o clique para ligar saem por
        webhook. Enviar a lista usa o mesmo crédito do Excel (uma vez por CNPJ).
        Ligar e receber tabulação são grátis.
      </p>

      <div className="mt-8 space-y-8">
        {CATALOG_SECTIONS.map((section) => (
          <section key={section.kind}>
            <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-podium-muted">
              <span className="inline-block h-4 w-0.5 rounded-sm bg-podium-yellow" />
              {section.label}
            </h3>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {catalogItemsByKind(section.kind).map((item) => {
                const on = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pickTool(item)}
                    className={cn(
                      "group flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center transition duration-300",
                      on
                        ? "border-podium-yellow/50 bg-podium-yellow/10"
                        : "border-white/[0.08] bg-white/[0.04] hover:-translate-y-0.5 hover:border-white/15 motion-reduce:hover:translate-y-0",
                    )}
                  >
                    <IntegrationLogo item={item} active={on} />
                    <span
                      className={cn(
                        "text-[11px] font-bold leading-tight",
                        on ? "text-podium-yellow" : "text-podium-gray",
                      )}
                    >
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <GlassCard className="mt-8 max-w-xl space-y-4 p-5" highlight>
        <div ref={formRef} className="flex items-center gap-3">
          <IntegrationLogo item={selected} active />
          <div>
            <p className="text-sm font-bold">Conectar {selected.name}</p>
            <p className="text-[11px] text-podium-muted">
              {catalogKindLabel(selected.kind)} · via webhook
            </p>
          </div>
        </div>
        {customName ? (
          <label className="block text-sm text-podium-gray">
            Nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 outline-none focus:border-podium-yellow/40"
            />
          </label>
        ) : null}
        <label className="block text-sm text-podium-gray">
          URL de destino (HTTPS)
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.exemplo.com/grid"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 outline-none focus:border-podium-yellow/40"
          />
        </label>
        <label className="block text-sm text-podium-gray">
          Ramal / número de origem (opcional)
          <input
            value={callerId}
            onChange={(e) => setCallerId(e.target.value)}
            placeholder="1001"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 outline-none focus:border-podium-yellow/40"
          />
        </label>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="button"
          disabled={!url.trim() || create.isPending}
          onClick={() => create.mutate()}
          className="rounded-xl bg-podium-yellow px-4 py-2.5 text-sm font-extrabold text-podium-navy disabled:opacity-40"
        >
          Conectar {selected.id === "webhook" ? "webhook" : selected.name}
        </button>
        <Hint>
          O segredo HMAC aparece uma vez. Use o mesmo para assinar a tabulação
          de volta. Zapier, Make e n8n entram como ponte; o restante também
          recebe o JSON por URL HTTPS.
        </Hint>
      </GlassCard>

      {secretOnce ? (
        <GlassCard className="mt-4 max-w-xl space-y-3 p-5">
          <p className="text-sm font-bold text-podium-yellow">
            Guarde o segredo agora
          </p>
          <code className="block break-all rounded-xl bg-black/40 p-3 text-xs">
            {secretOnce}
          </code>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(secretOnce)}
            className="inline-flex items-center gap-2 text-xs font-bold text-podium-gray hover:text-podium-yellow"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </button>
          {created && created.kind !== "crm" ? (
            <TestRamalButton connection={created} />
          ) : null}
        </GlassCard>
      ) : null}

      <div className="mt-8 max-w-xl space-y-3">
        {connections.length === 0 && !list.isLoading ? (
          <p className="text-sm text-podium-muted">Nenhuma conexão ainda.</p>
        ) : null}
        {connections.map((c) => {
          const item = resolveCatalogItem(c.catalog_id, c.display_name);
          return (
            <GlassCard key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-bold">
                    {item ? (
                      <IntegrationLogo item={item} size="sm" active />
                    ) : null}
                    {c.display_name ?? c.provider}
                  </p>
                  <p className="mt-1 text-xs text-podium-muted">
                    {catalogKindLabel(c.kind)} · via webhook · {c.status}
                  </p>
                  {c.webhook_url ? (
                    <p className="mt-2 break-all text-xs text-podium-gray">
                      Destino: {c.webhook_url}
                    </p>
                  ) : null}
                  <p className="mt-1 break-all text-xs text-podium-gray">
                    Inbound: {c.inbound_url}
                  </p>
                  {c.kind !== "crm" ? (
                    <div className="mt-3">
                      <TestRamalButton connection={c} />
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate(c.id)}
                  className="rounded-xl border border-white/10 p-2 text-podium-muted hover:text-red-400"
                  aria-label="Remover conexão"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </AppShell>
  );
}
