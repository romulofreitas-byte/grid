"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { usePaywall } from "@/components/PaywallDialog";
import { BILLING_ME_QUERY_KEY } from "@/hooks/useBillingMe";
import { ENRICH_CREDIT_COST, creditsPhrase } from "@/lib/billing/catalog";
import { isBillingGateError, throwIfBillingGate } from "@/lib/billing/paywall";
import { COPY } from "@/lib/copy";
import { attachCompanyHitToDeal, enrichJobIsSettled } from "@/lib/crm/add-deal";
import { CRM_FIELD, CRM_LABEL, crmFetch } from "@/lib/crm/client";
import { crmCompanyAttachMode } from "@/lib/crm/company-attach";
import { clearCachedDealBriefing } from "@/lib/crm/deal-extras-cache";
import type { CrmDealCard } from "@/lib/crm/types";
import { canSearchCompanies } from "@/lib/data/company-search";
import { formatCnpj } from "@/lib/format";
import type { CompanySearchHit } from "@/lib/types";
import { cn } from "@/lib/utils";

const ENRICH_POLL_INTERVAL_MS = 1000;
const ENRICH_POLL_TIMEOUT_MS = 25_000;

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

function CnpjValue({ cnpj, divided }: { cnpj: string; divided?: boolean }) {
  return (
    <div className={cn("px-2.5 py-2", divided && "border-b border-white/10")}>
      <p className={CRM_LABEL}>CNPJ</p>
      <p className="mt-1 font-mono text-[11px] leading-normal text-podium-gray">
        {formatCnpj(cnpj)}
      </p>
    </div>
  );
}

export function CrmDealGridAttach({
  deal,
  onChange,
  audited,
  briefingReady,
  onQualified,
}: {
  deal: CrmDealCard;
  onChange: (deal: CrmDealCard) => void;
  audited: boolean;
  briefingReady: boolean;
  onQualified: () => Promise<void> | void;
}) {
  const qc = useQueryClient();
  const { openPaywall } = usePaywall();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(deal.company_name);
  const [qualify, setQualify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const debounced = useDebounced(q.trim(), 300);
  const mode = crmCompanyAttachMode({
    cnpj: deal.cnpj,
    source: deal.meta.source,
    audited,
    briefingReady,
  });
  const search = useQuery({
    queryKey: ["crm-deal-grid-attach", debounced],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ q: debounced });
      const res = await fetch(`/api/empresas?${params}`, { signal });
      if (!res.ok) throw new Error("Não foi possível buscar");
      return (await res.json()) as CompanySearchHit[];
    },
    enabled: open && canSearchCompanies(debounced),
    placeholderData: keepPreviousData,
  });

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
      if (qualify) {
        await qualifyCnpj(patch.cnpj);
      }
      setOpen(false);
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

  if (mode === "hidden") return null;

  if (mode === "cnpj" && deal.cnpj) {
    return (
      <div className="shrink-0 rounded-md border border-white/10 bg-white/[0.03] p-2.5">
        <p className={CRM_LABEL}>CNPJ</p>
        <p className={cn(CRM_FIELD, "mt-1 font-mono")}>{formatCnpj(deal.cnpj)}</p>
      </div>
    );
  }

  if (mode === "qualify" && deal.cnpj) {
    return (
      <CnpjCard>
        <CnpjValue cnpj={deal.cnpj} divided />
        <div className="px-2.5 py-2">
          {saving ? (
            <div>
              <p className="text-[11px] font-medium text-podium-white">
                {COPY.crmQualifying}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-podium-yellow" />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void qualifyExisting()}
              className="inline-flex w-full items-center justify-center rounded-md border border-white/15 px-2 py-1.5 text-[11px] font-medium text-podium-gray hover:border-podium-yellow/35 hover:text-podium-white"
            >
              {COPY.crmQualifyNow}
            </button>
          )}
          <p className="mt-1.5 text-[10px] text-podium-muted">
            {creditsPhrase(ENRICH_CREDIT_COST)} · só se ainda não foi cobrado
          </p>
          {error ? (
            <p className="mt-1 text-[11px] text-podium-alert">{error}</p>
          ) : null}
        </div>
      </CnpjCard>
    );
  }

  return (
    <CnpjCard>
      <div className="border-b border-white/10 px-2.5 py-2">
        <p className={CRM_LABEL}>{COPY.crmSearchGrid}</p>
      </div>
      <div className="px-2.5 py-2">
        {!open ? (
          <button
            type="button"
            onClick={() => {
              setQ(deal.company_name);
              setOpen(true);
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-white/15 px-2 py-1.5 text-[11px] font-medium text-podium-gray hover:border-podium-yellow/35 hover:text-podium-white"
          >
            <Search className="h-3.5 w-3.5" />
            {COPY.crmSearchGrid}
          </button>
        ) : (
          <div className="space-y-2">
            <input
              className={CRM_FIELD}
              value={q}
              autoComplete="off"
              placeholder="Razão social"
              onChange={(event) => setQ(event.target.value)}
            />
            <label className="flex items-start gap-2 text-[11px] text-podium-gray">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={qualify}
                onChange={(event) => setQualify(event.target.checked)}
              />
              {COPY.crmQualifyNow} ({creditsPhrase(ENRICH_CREDIT_COST)})
            </label>
            <ul className="max-h-40 overflow-y-auto rounded-md border border-white/10">
              {search.isFetching ? (
                <li className="px-2 py-2 text-[11px] text-podium-muted">Buscando…</li>
              ) : (search.data ?? []).length === 0 ? (
                <li className="px-2 py-2 text-[11px] text-podium-muted">
                  {canSearchCompanies(debounced)
                    ? "Nenhuma empresa clara. Não chutamos homônimo."
                    : "Digite a razão social."}
                </li>
              ) : (
                (search.data ?? []).map((hit) => (
                  <li key={hit.cnpj}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void pick(hit)}
                      className="flex w-full flex-col items-start px-2 py-1.5 text-left hover:bg-white/5 disabled:opacity-50"
                    >
                      <span className="text-[11px] font-medium text-podium-white">
                        {hit.razaoSocial}
                      </span>
                      <span className="font-mono text-[10px] text-podium-muted">
                        {formatCnpj(hit.cnpj)}
                        {hit.municipio ? ` · ${hit.municipio}/${hit.uf}` : ""}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <button
              type="button"
              className="text-[10px] text-podium-muted underline-offset-2 hover:underline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
          </div>
        )}
        {error ? <p className="mt-1 text-[11px] text-podium-alert">{error}</p> : null}
      </div>
    </CnpjCard>
  );
}
