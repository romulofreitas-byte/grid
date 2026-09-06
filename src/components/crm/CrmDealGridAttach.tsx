"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { usePaywall } from "@/components/PaywallDialog";
import { BILLING_ME_QUERY_KEY } from "@/hooks/useBillingMe";
import { ENRICH_CREDIT_COST, creditsPhrase } from "@/lib/billing/catalog";
import { isBillingGateError, throwIfBillingGate } from "@/lib/billing/paywall";
import { COPY } from "@/lib/copy";
import { attachCompanyHitToDeal, enrichJobIsSettled } from "@/lib/crm/add-deal";
import { CRM_FIELD, CRM_LABEL, crmFetch } from "@/lib/crm/client";
import {
  GRID_ATTACH_HIT_LIMIT,
  crmCompanyAttachMode,
  isCrmEnrichableSource,
} from "@/lib/crm/company-attach";
import { clearCachedDealBriefing } from "@/lib/crm/deal-extras-cache";
import type { CrmDealCard } from "@/lib/crm/types";
import { canSearchCompanies } from "@/lib/data/company-search";
import { formatCnpj } from "@/lib/format";
import type { CompanySearchHit } from "@/lib/types";
import { cn } from "@/lib/utils";

const ENRICH_POLL_INTERVAL_MS = 1000;
const ENRICH_POLL_TIMEOUT_MS = 25_000;

const skippedGridAttach = new Set<string>();

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function pollEnrichSettled(cnpj: string) {
  const deadline = Date.now() + ENRICH_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const poll = await fetch(`/api/enrich?cnpj=${encodeURIComponent(cnpj)}`);
    if (poll.ok) {
      const body = (await poll.json()) as { jobStatus?: string | null };
      if (enrichJobIsSettled(body.jobStatus)) return;
    }
    await sleep(ENRICH_POLL_INTERVAL_MS);
  }
}

function CnpjCard({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 rounded-md border border-white/10 bg-white/[0.03]">
      {children}
    </div>
  );
}

function AttachSteps({ phase }: { phase: "search" | "qualify" }) {
  const searchActive = phase === "search";
  const qualifyActive = phase === "qualify";
  return (
    <ol className="flex shrink-0 items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]">
      <li
        aria-current={searchActive ? "step" : undefined}
        className={cn(
          "inline-flex items-center gap-1",
          searchActive ? "text-podium-search" : "text-podium-success",
        )}
      >
        {qualifyActive ? <Check className="h-3 w-3" strokeWidth={2.4} /> : null}
        <span>1 · {COPY.crmAttachStepSearch}</span>
      </li>
      <li aria-hidden className="text-white/20">
        —
      </li>
      <li
        aria-current={qualifyActive ? "step" : undefined}
        className={qualifyActive ? "text-podium-success" : "text-white/35"}
      >
        2 · {COPY.crmAttachStepQualify}
      </li>
    </ol>
  );
}

function hitPlace(hit: CompanySearchHit): string {
  if (!hit.municipio) return formatCnpj(hit.cnpj);
  return `${formatCnpj(hit.cnpj)} · ${hit.municipio}/${hit.uf}`;
}

export function CrmDealGridAttach({
  deal,
  onChange,
  audited,
  briefingReady,
  onQualified,
  surface,
}: {
  deal: CrmDealCard;
  onChange: (deal: CrmDealCard) => void;
  audited: boolean;
  briefingReady: boolean;
  onQualified: () => Promise<void> | void;
  surface: "banner" | "aside";
}) {
  const qc = useQueryClient();
  const { openPaywall } = usePaywall();
  const [q, setQ] = useState(deal.company_name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [skipped, setSkipped] = useState(() => skippedGridAttach.has(deal.id));
  const [pinnedQualify, setPinnedQualify] = useState(false);
  const debounced = useDebounced(q.trim(), 300);
  const computedMode = crmCompanyAttachMode({
    cnpj: deal.cnpj,
    source: deal.meta.source,
    audited,
    briefingReady,
  });
  const mode =
    pinnedQualify &&
    deal.cnpj &&
    !audited &&
    isCrmEnrichableSource(deal.meta.source)
      ? "qualify"
      : computedMode;
  const searching = mode === "search" && !skipped;
  const search = useQuery({
    queryKey: ["crm-deal-grid-attach", debounced],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ q: debounced });
      const res = await fetch(`/api/empresas?${params}`, { signal });
      if (!res.ok) throw new Error("Não foi possível buscar");
      return (await res.json()) as CompanySearchHit[];
    },
    enabled: searching && canSearchCompanies(debounced),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    setQ(deal.company_name);
    setError(null);
    setSkipped(skippedGridAttach.has(deal.id));
    setPinnedQualify(false);
  }, [deal.id, deal.company_name]);

  async function qualifyCnpj(cnpj: string) {
    const enrich = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cnpjs: [cnpj] }),
    });
    const json = (await enrich.json()) as { error?: string };
    throwIfBillingGate(enrich.status, json, openPaywall, "qualify");
    if (!enrich.ok) {
      throw new Error(json.error ?? "Não qualificou a ficha.");
    }
    await pollEnrichSettled(cnpj);
    clearCachedDealBriefing(deal.id);
    void qc.invalidateQueries({ queryKey: BILLING_ME_QUERY_KEY });
    await onQualified();
  }

  async function pick(hit: CompanySearchHit) {
    setSaving(true);
    setError(null);
    try {
      const patch = attachCompanyHitToDeal(deal, hit);
      const res = await crmFetch<{ deal: CrmDealCard }>(
        `/api/crm/deals/${deal.id}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      clearCachedDealBriefing(deal.id);
      onChange(res.deal);
      if (isCrmEnrichableSource(deal.meta.source)) {
        setPinnedQualify(true);
      }
    } catch (err) {
      if (isBillingGateError(err)) return;
      setError(err instanceof Error ? err.message : "Não casou a empresa.");
    } finally {
      setSaving(false);
    }
  }

  async function qualifyExisting() {
    if (!deal.cnpj) return;
    setSaving(true);
    setError(null);
    try {
      await qualifyCnpj(deal.cnpj);
    } catch (err) {
      if (isBillingGateError(err)) return;
      setError(err instanceof Error ? err.message : "Não qualificou.");
    } finally {
      setSaving(false);
    }
  }

  function skipCnpj() {
    skippedGridAttach.add(deal.id);
    setSkipped(true);
  }

  if (mode === "hidden") return null;
  if (mode === "search" && skipped) return null;

  if (mode === "cnpj" && deal.cnpj) {
    if (surface !== "aside") return null;
    return (
      <CnpjCard>
        <div className="p-2.5">
          <p className={CRM_LABEL}>CNPJ</p>
          <p className={cn(CRM_FIELD, "mt-1 font-mono")}>{formatCnpj(deal.cnpj)}</p>
        </div>
      </CnpjCard>
    );
  }

  const hits = (search.data ?? []).slice(0, GRID_ATTACH_HIT_LIMIT);
  const searched = canSearchCompanies(debounced);
  const searchPending = searching && search.isFetching;
  const searchEmpty =
    searching && searched && !search.isFetching && !search.isError && hits.length === 0;
  const qualifyHint = COPY.crmQualifyCreditHint.replace(
    "{credits}",
    creditsPhrase(ENRICH_CREDIT_COST),
  );

  if (mode === "qualify" && deal.cnpj) {
    if (surface !== "banner") return null;
    return (
      <section
        aria-label={COPY.crmQualifyGrid}
        aria-busy={saving}
        className="attach-strip-qualify shrink-0"
      >
        <div
          className="telemetry-bar"
          data-tone="qualify"
          aria-hidden
        />
        <div className="px-3 py-2.5 md:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-success">
              {COPY.crmQualifyGrid}
            </p>
            <AttachSteps phase="qualify" />
          </div>
          <p className="mt-2 font-mono text-[11px] text-podium-gray">
            {formatCnpj(deal.cnpj)}
            {deal.company_name ? ` · ${deal.company_name}` : ""}
          </p>
          {saving ? (
            <p className="mt-2 text-xs font-medium text-podium-white">
              {COPY.crmQualifying}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void qualifyExisting()}
              className="mt-2.5 inline-flex w-full items-center justify-center rounded-md bg-podium-success px-3 py-2 text-xs font-semibold text-podium-navy hover:brightness-110"
            >
              {COPY.crmQualifyNow} · {creditsPhrase(ENRICH_CREDIT_COST)}
            </button>
          )}
          <p className="mt-1.5 text-[10px] text-podium-muted">{qualifyHint}</p>
          {error ? (
            <p className="mt-1 text-[11px] text-podium-alert">{error}</p>
          ) : null}
        </div>
      </section>
    );
  }

  if (mode !== "search") return null;
  if (surface !== "banner") return null;

  return (
    <section
      aria-label={COPY.crmSearchGrid}
      aria-busy={searchPending || saving}
      className="attach-strip-search shrink-0"
    >
      <div
        className="telemetry-bar"
        data-tone="search"
        aria-hidden
      />
      <div className="px-3 py-2.5 md:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-search">
            {searchPending ? COPY.crmSearchingGrid : COPY.crmSearchGrid}
          </p>
          <AttachSteps phase="search" />
        </div>
        <input
          className={cn(
            CRM_FIELD,
            "mt-2 border-podium-search/35 bg-podium-navy/55 focus:border-podium-search/70",
          )}
          value={q}
          autoComplete="off"
          placeholder={COPY.crmSearchGridPlaceholder}
          onChange={(event) => setQ(event.target.value)}
        />
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border border-podium-search/20 bg-podium-navy/40">
          {searchPending && hits.length === 0 ? (
            <li className="px-2.5 py-2 text-[11px] text-podium-search/80">
              {COPY.crmSearchingGrid}
            </li>
          ) : search.isError && hits.length === 0 ? (
            <li className="px-2.5 py-2 text-[11px] text-podium-alert">
              Não foi possível buscar.
            </li>
          ) : hits.length === 0 ? (
            <li className="px-2.5 py-2 text-[11px] text-podium-muted">
              {searched ? COPY.crmSearchGridEmpty : COPY.crmSearchGridType}
            </li>
          ) : (
            hits.map((hit) => (
              <li key={hit.cnpj} className="border-b border-white/5 last:border-b-0">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void pick(hit)}
                  className="flex w-full flex-col items-start px-2.5 py-1.5 text-left hover:bg-podium-search/10 disabled:opacity-50"
                >
                  <span className="text-[11px] font-medium text-podium-white">
                    {hit.razaoSocial}
                  </span>
                  <span className="font-mono text-[10px] text-podium-muted">
                    {hitPlace(hit)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        {searchEmpty ? (
          <button
            type="button"
            className="mt-2 text-[10px] text-podium-muted underline-offset-2 hover:text-podium-gray hover:underline"
            onClick={skipCnpj}
          >
            {COPY.crmSearchGridSkip}
          </button>
        ) : null}
        {error ? <p className="mt-1 text-[11px] text-podium-alert">{error}</p> : null}
      </div>
    </section>
  );
}
