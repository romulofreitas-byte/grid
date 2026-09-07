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
import { Button, buttonClassName } from "@/components/ui/Button";
import { gridHref, largadaIntentHref } from "@/lib/back";
import { COPY } from "@/lib/copy";
import { matchActivitySuggestion } from "@/lib/activity-suggestion";
import {
  canSearchCompanies,
  isFullCnpjQuery,
} from "@/lib/data/company-search";
import { displayCompanyName } from "@/lib/enrichment/company-name";
import { formatCnpj, formatPhone } from "@/lib/format";
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

function formatHitPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return raw;
  return formatPhone(digits.slice(0, 2), digits.slice(2)) || raw;
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
  const phone =
    "telefone" in hit ? formatHitPhone(hit.telefone) : null;
  function warm() {
    qc.setQueryData(leadPreviewKey(hit.cnpj), companyHitToPreview(hit));
    void qc.prefetchQuery({
      queryKey: leadQueryKey(hit.cnpj),
      queryFn: () => fetchLeadDossier(hit.cnpj),
      staleTime: 30_000,
    });
  }
  return (
    <GlassCard className="flex flex-col gap-3 px-3 py-3 hover:translate-y-0 hover:bg-white/[0.03] sm:flex-row sm:items-center">
      <Link
        href={`/lead/${hit.cnpj}?from=empresas`}
        onClick={() => {
          warm();
          onOpen();
        }}
        onPointerEnter={warm}
        onFocus={warm}
        className="min-w-0 flex-1"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-semibold text-podium-white">
            {displayCompanyName(hit.nomeFantasia, hit.razaoSocial)}
          </p>
          <p className="shrink-0 text-[11px] text-podium-muted">
            {hit.municipio}/{hit.uf}
          </p>
        </div>
        {hit.nomeFantasia ? (
          <p className="mt-0.5 truncate text-[11px] text-podium-muted">
            {hit.razaoSocial}
          </p>
        ) : null}
        <p className="mt-0.5 truncate text-[11px] tabular-nums text-podium-muted">
          {formatCnpj(hit.cnpj)}
          {phone ? <span> · {phone}</span> : null}
          {"decisorNome" in hit && hit.decisorNome ? (
            <span> · {hit.decisorNome}</span>
          ) : null}
        </p>
      </Link>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={saving}
        onClick={() => onSaveToPista(hit)}
        className="min-h-11 w-full shrink-0 sm:min-h-0 sm:w-auto"
      >
        <Flag className="h-3 w-3" />
        {saving ? "Salvando…" : COPY.salvarNaPista}
      </Button>
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
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setImmediate(draft.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-podium-muted" />
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
            className="h-11 w-full rounded-md border border-white/10 bg-podium-panel py-1.5 pl-9 pr-3 text-base outline-none focus:border-podium-yellow/40 md:h-auto md:py-1.5 md:text-sm"
            aria-label="Buscar empresas"
          />
        </div>
        <Button type="submit" variant="primary" size="md">
          Buscar
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setUfOpen((v) => !v)}
          className={buttonClassName({
            variant: ufs.length || ufOpen ? "accent" : "secondary",
            size: "sm",
          })}
        >
          {ufs.length ? ufs.join(" · ") : "Brasil"}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition", ufOpen && "rotate-180")}
          />
        </button>
        {ufs.map((uf) => (
          <button
            key={uf}
            type="button"
            onClick={() => setUfs((cur) => cur.filter((u) => u !== uf))}
            className={buttonClassName({ variant: "accent", size: "sm" })}
          >
            {uf} ×
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSoMatriz((v) => !v)}
          className={buttonClassName({
            variant: soMatriz ? "accent" : "secondary",
            size: "sm",
          })}
        >
          Só matriz
        </button>
      </div>
      {ufOpen ? (
        <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-white/10 p-2 md:max-h-none md:overflow-visible md:border-0 md:p-0">
          <div className="flex flex-wrap gap-1">
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
                className={buttonClassName({
                  variant: on ? "accent" : "secondary",
                  size: "sm",
                })}
              >
                {uf}
              </button>
            );
          })}
          </div>
        </div>
      ) : null}

      {listaHref && activity ? (
        <GlassCard className="mt-4 p-3 hover:translate-y-0">
          <Link href={listaHref} className="block">
            <p className="text-sm font-semibold text-podium-yellow">
              {COPY.empresasListaCta.replace("{nicho}", activity.nome)}
            </p>
            <p className="mt-1 text-pretty text-xs text-podium-muted">
              {COPY.empresasListaHint}
            </p>
          </Link>
        </GlassCard>
      ) : null}

      {query.isFetching && hits.length === 0 ? (
        <div className="mt-4 space-y-1">
          <div className="h-12 animate-pulse rounded-md bg-white/5" />
          <div className="h-12 animate-pulse rounded-md bg-white/5" />
          <div className="h-12 animate-pulse rounded-md bg-white/5" />
        </div>
      ) : query.isError ? (
        <GlassCard className="mt-4 p-3 text-sm text-podium-muted">
          Não foi possível buscar. Tente de novo.
        </GlassCard>
      ) : ready && hits.length === 0 && !query.isFetching ? (
        <GlassCard className="mt-4 p-3 text-sm text-podium-muted">
          {isFullCnpjQuery(q)
            ? COPY.empresaForaDaBase
            : `Nenhuma empresa encontrada para “${q}”.`}
        </GlassCard>
      ) : hits.length > 0 ? (
        <div className="mt-4 space-y-1">
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
        <p className="mt-4 text-sm text-podium-muted">
          {COPY.empresasMinChars}
        </p>
      ) : null}

      {!ready && recent.length > 0 ? (
        <section className="mt-6">
          <SectionTitle>Recentes</SectionTitle>
          {saveError ? (
            <p className="mt-1.5 text-sm text-podium-yellow">{saveError}</p>
          ) : null}
          <div className="mt-3 space-y-1">
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
