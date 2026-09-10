"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Flag, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AddCompanyToCrmDialog } from "@/components/crm/AddCompanyToCrmDialog";
import { GlassCard } from "@/components/GlassCard";
import { SectionTitle } from "@/components/SectionTitle";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClassName } from "@/components/ui/Button";
import { crmHref, largadaIntentHref } from "@/lib/back";
import { COPY } from "@/lib/copy";
import { CRM_ACTIVITY_KIND_LABELS } from "@/lib/crm/activity";
import { digitsCnpj } from "@/lib/crm/bridge";
import { matchActivitySuggestion } from "@/lib/activity-suggestion";
import {
  canSearchCompanies,
  isFullCnpjQuery,
} from "@/lib/data/company-search";
import {
  asCompanySearchHit,
  companyGridAction,
  type CompanyGridContext,
} from "@/lib/empresas/context";
import { displayCompanyName } from "@/lib/enrichment/company-name";
import { formatCnpj, formatPhone } from "@/lib/format";
import {
  forgetRecentCompany,
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

function useCompanyGridContext(cnpjs: string[]) {
  const key = cnpjs.join(",");
  return useQuery({
    queryKey: ["empresas-contexto", key],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ cnpjs: key });
      const res = await fetch(`/api/empresas/contexto?${params}`, { signal });
      if (!res.ok) throw new Error("Não foi possível ler o Grid");
      const json = (await res.json()) as { items: CompanyGridContext[] };
      return json.items;
    },
    enabled: cnpjs.length > 0,
  });
}

function CompanyRow({
  hit,
  context,
  onOpen,
  onEnterCrm,
  onForget,
}: {
  hit: CompanySearchHit | RecentCompany;
  context?: CompanyGridContext;
  onOpen: () => void;
  onEnterCrm: (hit: CompanySearchHit) => void;
  onForget?: () => void;
}) {
  const qc = useQueryClient();
  const phone =
    "telefone" in hit ? formatHitPhone(hit.telefone) : null;
  const action = companyGridAction(context);
  function warm() {
    qc.setQueryData(leadPreviewKey(hit.cnpj), companyHitToPreview(hit));
    void qc.prefetchQuery({
      queryKey: leadQueryKey(hit.cnpj),
      queryFn: () => fetchLeadDossier(hit.cnpj),
      staleTime: 30_000,
    });
  }
  const crmLabel = context?.crm
    ? [context.crm.pipelineNome, context.crm.stageNome]
        .filter(Boolean)
        .join(" · ")
    : null;
  const nextLabel = context?.crm?.nextKind
    ? CRM_ACTIVITY_KIND_LABELS[context.crm.nextKind]
    : null;
  const ctaClass = "min-h-11 w-full shrink-0 sm:min-h-0 sm:w-auto";
  const cta =
    action.type === "open_crm" ? (
      <Link
        href={action.href}
        className={buttonClassName({
          variant: "secondary",
          size: "sm",
          className: ctaClass,
        })}
      >
        {COPY.crmOpenDeal}
      </Link>
    ) : action.type === "open_list" ? (
      <Link
        href={action.href}
        className={buttonClassName({
          variant: "secondary",
          size: "sm",
          className: ctaClass,
        })}
      >
        {COPY.empresasAbrirLista}
      </Link>
    ) : (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => onEnterCrm(asCompanySearchHit(hit))}
        className={ctaClass}
      >
        <Flag className="h-3 w-3" />
        {COPY.empresasEntrarCrm}
      </Button>
    );

  return (
    <GlassCard className="group flex flex-col gap-3 px-3 py-3 hover:translate-y-0 hover:bg-white/[0.03] sm:flex-row sm:items-center">
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
        <p className="min-w-0 truncate text-sm font-semibold text-podium-white">
          {displayCompanyName(hit.nomeFantasia, hit.razaoSocial)}
        </p>
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
        {context ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {crmLabel ? (
              <Badge variant="accent">{crmLabel}</Badge>
            ) : null}
            {context.list ? (
              <Badge>{context.list.nome}</Badge>
            ) : null}
            {context.qualified ? (
              <Badge variant="success">{COPY.gridQualified}</Badge>
            ) : null}
            {context.called ? (
              <Badge>{COPY.gridCalledToday}</Badge>
            ) : nextLabel ? (
              <Badge variant="warning">{nextLabel}</Badge>
            ) : null}
          </div>
        ) : null}
      </Link>
      <div className="flex w-full flex-col items-end gap-1.5 sm:w-auto">
        <p className="text-[11px] text-podium-muted">
          {hit.municipio}/{hit.uf}
        </p>
        {cta}
        {onForget ? (
          <button
            type="button"
            aria-label={COPY.empresasForgetRecent}
            onClick={onForget}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md text-podium-muted transition",
              "hover:bg-white/10 hover:text-podium-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-podium-yellow/40",
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
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
  const [addHit, setAddHit] = useState<CompanySearchHit | null>(null);
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

  const shownCnpjs = useMemo(
    () =>
      (ready ? hits.map((hit) => hit.cnpj) : recent.map((hit) => hit.cnpj)).map(
        digitsCnpj,
      ),
    [hits, ready, recent],
  );
  const contextQuery = useCompanyGridContext(shownCnpjs);
  const contextByCnpj = useMemo(() => {
    const map = new Map<string, CompanyGridContext>();
    for (const item of contextQuery.data ?? []) {
      map.set(digitsCnpj(item.cnpj), item);
    }
    return map;
  }, [contextQuery.data]);

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
      <p className="mt-2 text-pretty text-xs text-podium-muted">
        {COPY.empresasHint}
      </p>

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
          {query.isFetching ? (
            <p className="text-xs text-podium-muted">Buscando…</p>
          ) : null}
          {hits.map((h) => (
            <CompanyRow
              key={h.cnpj}
              hit={h}
              context={contextByCnpj.get(digitsCnpj(h.cnpj))}
              onOpen={() => openCompany(h)}
              onEnterCrm={setAddHit}
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
          <div className="mt-3 space-y-1">
            {recent.map((h) => (
              <CompanyRow
                key={h.cnpj}
                hit={h}
                context={contextByCnpj.get(digitsCnpj(h.cnpj))}
                onOpen={() => openCompany(h)}
                onEnterCrm={setAddHit}
                onForget={() => setRecent(forgetRecentCompany(h.cnpj))}
              />
            ))}
          </div>
        </section>
      ) : null}

      {addHit ? (
        <AddCompanyToCrmDialog
          company={addHit}
          onClose={() => setAddHit(null)}
          onCreated={(deal) => {
            setAddHit(null);
            router.push(crmHref({ pipeline: deal.pipelineId, deal: deal.id }));
          }}
        />
      ) : null}
    </AppShell>
  );
}
