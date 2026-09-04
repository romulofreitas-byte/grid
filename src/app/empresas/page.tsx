"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Flag, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { SaveToCrmTelemetry } from "@/components/SaveToCrmTelemetry";
import { SectionTitle } from "@/components/SectionTitle";
import { gridHref, largadaIntentHref } from "@/lib/back";
import { COPY } from "@/lib/copy";
import { matchActivitySuggestion } from "@/lib/activity-suggestion";
import {
  canSearchCompanies,
  isFullCnpjQuery,
} from "@/lib/data/company-search";
import { displayCompanyName } from "@/lib/enrichment/company-name";
import { formatCnpj } from "@/lib/format";
import {
  readRecentCompanies,
  rememberRecentCompany,
  type RecentCompany,
} from "@/lib/recent-companies";
import type { CompanySearchHit } from "@/lib/types";
import {
  companyHitToPreview,
  fetchLeadDossier,
  leadPreviewKey,
  leadQueryKey,
} from "@/lib/lead-query";
import { cn } from "@/lib/utils";

const ALL_UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function CompanyRow({
  hit,
  onOpen,
  onSaveToPista,
  saving,
}: {
  hit: CompanySearchHit | RecentCompany;
  onOpen: () => void;
  onSaveToPista: (hit: CompanySearchHit | RecentCompany) => void;
  saving: boolean;
}) {
  const qc = useQueryClient();
  function warm() {
    qc.setQueryData(leadPreviewKey(hit.cnpj), companyHitToPreview(hit));
    void qc.prefetchQuery({
      queryKey: leadQueryKey(hit.cnpj),
      queryFn: () => fetchLeadDossier(hit.cnpj),
      staleTime: 30_000,
    });
  }
  return (
    <GlassCard className="mb-2 px-4 py-3 hover:bg-white/[0.03]">
      <Link
        href={`/lead/${hit.cnpj}?from=empresas`}
        onClick={() => {
          warm();
          onOpen();
        }}
        onPointerEnter={warm}
        onFocus={warm}
        className="block"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate font-bold">
            {displayCompanyName(hit.nomeFantasia, hit.razaoSocial)}
          </p>
          <p className="shrink-0 text-xs text-podium-muted">
            {hit.municipio}/{hit.uf}
          </p>
        </div>
        {hit.nomeFantasia ? (
          <p className="mt-0.5 truncate text-xs text-podium-muted">
            {hit.razaoSocial}
          </p>
        ) : null}
        <p className="mt-1 text-xs tabular-nums text-podium-muted">
          {formatCnpj(hit.cnpj)}
          {"decisorNome" in hit && hit.decisorNome ? (
            <span className="ml-2 normal-case">· Decisor: {hit.decisorNome}</span>
          ) : null}
        </p>
      </Link>
      <button
        type="button"
        disabled={saving}
        onClick={() => onSaveToPista(hit)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-podium-yellow px-3 py-1.5 text-xs font-bold text-podium-navy disabled:opacity-40"
      >
        <Flag className="h-3 w-3" />
        {saving ? "Salvando…" : COPY.salvarNaPista}
      </button>
    </GlassCard>
  );
}

export default function EmpresasPage() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [immediate, setImmediate] = useState<string | null>(null);
  const [ufs, setUfs] = useState<string[]>([]);
  const [soMatriz, setSoMatriz] = useState(false);
  const [ufOpen, setUfOpen] = useState(false);
  const [recent, setRecent] = useState<RecentCompany[]>([]);
  const [savingCnpj, setSavingCnpj] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounced = useDebounced(draft, 300);
  const q = (immediate ?? debounced).trim();
  const ready = canSearchCompanies(q);

  useEffect(() => {
    setRecent(readRecentCompanies());
  }, []);

  function openCompany(
    hit: Pick<
      CompanySearchHit,
      "cnpj" | "razaoSocial" | "nomeFantasia" | "municipio" | "uf"
    >,
  ) {
    setRecent(rememberRecentCompany(hit));
  }

  const query = useQuery({
    queryKey: ["empresas-page", q, ufs, soMatriz],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ q });
      if (ufs.length) params.set("ufs", ufs.join(","));
      if (soMatriz) params.set("soMatriz", "1");
      const res = await fetch(`/api/empresas?${params}`, { signal });
      if (!res.ok) throw new Error("Não foi possível buscar");
      return (await res.json()) as CompanySearchHit[];
    },
    enabled: ready,
    placeholderData: keepPreviousData,
  });

  const hits = ready ? (query.data ?? []) : [];
  const activity = useMemo(
    () => (ready ? matchActivitySuggestion(q) : null),
    [ready, q],
  );
  const listaHref = activity
    ? largadaIntentHref(activity.query, { uf: ufs.length === 1 ? ufs[0] : undefined })
    : null;

  async function saveToPista(hit: { cnpj: string }) {
    setSaveError(null);
    setSavingCnpj(hit.cnpj);
    try {
      const res = await fetch("/api/empresas/pista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: hit.cnpj }),
      });
      const json = (await res.json()) as { searchId?: string; error?: string };
      if (!res.ok || !json.searchId) {
        throw new Error(json.error ?? "Não foi possível salvar no CRM");
      }
      router.push(gridHref(json.searchId, "empresas"));
    } catch (err) {
      setSavingCnpj(null);
      setSaveError(
        err instanceof Error ? err.message : "Não foi possível salvar no CRM",
      );
    }
  }

  return (
    <AppShell title="Empresas" back={{ href: "/painel", label: "Voltar ao Painel" }}>
      <h1 className="text-2xl font-extrabold">Buscar empresas</h1>
      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setImmediate(draft.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-podium-muted" />
          <input
            value={draft}
            onChange={(e) => {
              setImmediate(null);
              setDraft(e.target.value);
            }}
            placeholder={COPY.empresasPlaceholder}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-white/10 bg-podium-panel py-3 pl-10 pr-3 text-sm outline-none focus:border-podium-yellow/40"
            aria-label="Buscar empresas"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-podium-yellow px-5 text-sm font-bold text-podium-navy"
        >
          Buscar
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setUfOpen((v) => !v)}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold",
            ufs.length || ufOpen
              ? "bg-podium-yellow text-podium-navy"
              : "bg-white/5 text-podium-gray",
          )}
        >
          {ufs.length ? ufs.join(" · ") : "Brasil"}
          <ChevronDown
            className={cn("h-4 w-4 transition", ufOpen && "rotate-180")}
          />
        </button>
        {ufs.map((uf) => (
          <button
            key={uf}
            type="button"
            onClick={() => setUfs((cur) => cur.filter((u) => u !== uf))}
            className="rounded-xl bg-podium-yellow/20 px-3 py-2 text-sm font-bold text-podium-yellow"
          >
            {uf} ×
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSoMatriz((v) => !v)}
          className={cn(
            "rounded-xl px-3 py-2 text-sm font-bold",
            soMatriz
              ? "bg-podium-yellow text-podium-navy"
              : "bg-white/5 text-podium-gray",
          )}
        >
          Só matriz
        </button>
      </div>
      {ufOpen ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {ALL_UFS.map((uf) => {
            const on = ufs.includes(uf);
            return (
              <button
                key={uf}
                type="button"
                onClick={() =>
                  setUfs((cur) =>
                    on ? cur.filter((u) => u !== uf) : [...cur, uf],
                  )
                }
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-bold",
                  on
                    ? "bg-podium-yellow text-podium-navy"
                    : "bg-white/5 text-podium-gray",
                )}
              >
                {uf}
              </button>
            );
          })}
        </div>
      ) : null}

      {listaHref && activity ? (
        <GlassCard className="mt-6 p-4">
          <Link href={listaHref} className="block">
            <p className="text-sm font-bold text-podium-yellow">
              {COPY.empresasListaCta.replace("{nicho}", activity.nome)}
            </p>
            <p className="mt-1 text-pretty text-xs text-podium-muted">
              {COPY.empresasListaHint}
            </p>
          </Link>
        </GlassCard>
      ) : null}

      {query.isFetching && hits.length === 0 ? (
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-white/5" />
      ) : query.isError ? (
        <GlassCard className="mt-6 p-5 text-sm text-podium-muted">
          Não foi possível buscar. Tente de novo.
        </GlassCard>
      ) : ready && hits.length === 0 && !query.isFetching ? (
        <GlassCard className="mt-6 p-5 text-sm text-podium-muted">
          {isFullCnpjQuery(q)
            ? COPY.empresaForaDaBase
            : `Nenhuma empresa encontrada para “${q}”.`}
        </GlassCard>
      ) : hits.length > 0 ? (
        <div className="mt-6 space-y-3">
          <SaveToCrmTelemetry cta={COPY.salvarNaPista} />
          {saveError ? (
            <p className="text-sm text-podium-yellow">{saveError}</p>
          ) : null}
          {query.isFetching ? (
            <p className="text-xs text-podium-muted">Buscando…</p>
          ) : null}
          {hits.map((h) => (
            <CompanyRow
              key={h.cnpj}
              hit={h}
              onOpen={() => openCompany(h)}
              onSaveToPista={saveToPista}
              saving={savingCnpj === h.cnpj}
            />
          ))}
        </div>
      ) : draft.trim().length > 0 && !ready ? (
        <p className="mt-6 text-sm text-podium-muted">
          {COPY.empresasMinChars}
        </p>
      ) : null}

      {!ready && recent.length > 0 ? (
        <section className="mt-8">
          <SectionTitle>Recentes</SectionTitle>
          {saveError ? (
            <p className="mt-2 text-sm text-podium-yellow">{saveError}</p>
          ) : null}
          <div className="mt-4 space-y-1">
            {recent.map((h) => (
              <CompanyRow
                key={h.cnpj}
                hit={h}
                onOpen={() => openCompany(h)}
                onSaveToPista={saveToPista}
                saving={savingCnpj === h.cnpj}
              />
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
