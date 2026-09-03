"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { COPY } from "@/lib/copy";
import {
  dealFieldsFromCompanyHit,
  dealFieldsFromDossier,
  findDealByCnpj,
  mergeDealPhones,
  type AddDealSelectedCompany,
  type AddDealSocio,
} from "@/lib/crm/add-deal";
import { CRM_FIELD, CRM_LABEL } from "@/lib/crm/client";
import { canSearchCompanies } from "@/lib/data/company-search";
import { displayCompanyName } from "@/lib/enrichment/company-name";
import { formatCnpj } from "@/lib/format";
import { fetchLeadDossier } from "@/lib/lead-query";
import type { CompanySearchHit } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CrmAddDealInput = {
  company_name: string;
  contact_name: string;
  secretaries: string[];
  phones?: string[];
  cnpj?: string;
  meta?: { source: "crm_add" };
};

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function useCompanySearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ["crm-add-deal-empresas", q],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ q });
      const res = await fetch(`/api/empresas?${params}`, { signal });
      if (!res.ok) throw new Error("Não foi possível buscar");
      return (await res.json()) as CompanySearchHit[];
    },
    enabled: enabled && canSearchCompanies(q),
    placeholderData: keepPreviousData,
  });
}

export function CrmAddDealDialog({
  onClose,
  onCreate,
  onOpenExisting,
  pipelineDeals,
}: {
  onClose: () => void;
  onCreate: (input: CrmAddDealInput) => Promise<void>;
  onOpenExisting: (dealId: string) => void;
  pipelineDeals: Array<{ id: string; cnpj: string | null }>;
}) {
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [secretary, setSecretary] = useState("");
  const [phones, setPhones] = useState<string[]>([]);
  const [selected, setSelected] = useState<AddDealSelectedCompany | null>(null);
  const [socios, setSocios] = useState<AddDealSocio[] | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const debounced = useDebounced(company, 300);
  const search = useCompanySearch(debounced.trim(), !selected);
  const hits = !selected && canSearchCompanies(debounced.trim()) ? (search.data ?? []) : [];
  const showList = listOpen && !selected && canSearchCompanies(debounced.trim());
  const existing = selected ? findDealByCnpj(pipelineDeals, selected.cnpj) : null;

  const chipLabel = useMemo(() => {
    if (!selected) return null;
    const place = [selected.municipio, selected.uf].filter(Boolean).join("/");
    return place ? `${formatCnpj(selected.cnpj)} · ${place}` : formatCnpj(selected.cnpj);
  }, [selected]);

  useEffect(() => {
    if (!listOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setListOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [listOpen]);

  function pick(hit: CompanySearchHit) {
    const fields = dealFieldsFromCompanyHit(hit);
    setCompany(fields.company_name);
    setContact(fields.contact_name);
    setPhones(fields.phones);
    setSelected({
      cnpj: fields.cnpj,
      municipio: fields.municipio,
      uf: fields.uf,
    });
    setSocios(null);
    setListOpen(false);
    setError(null);
  }

  function unlink() {
    setSelected(null);
    setPhones([]);
    setSocios(null);
    setError(null);
    setListOpen(true);
  }

  async function pullFicha() {
    if (!selected || pulling) return;
    setPulling(true);
    setError(null);
    try {
      const dossier = await fetchLeadDossier(selected.cnpj);
      const extras = dealFieldsFromDossier(dossier);
      setPhones((current) => mergeDealPhones(current, extras.phones));
      setSocios(extras.socios);
      setContact((current) => current.trim() || extras.contact_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não puxou a ficha.");
    } finally {
      setPulling(false);
    }
  }

  async function submit() {
    if (existing) {
      onOpenExisting(existing.id);
      return;
    }
    if (!company.trim()) {
      setError("Informe o nome da empresa.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        company_name: company.trim(),
        contact_name: contact.trim(),
        secretaries: secretary.trim() ? [secretary.trim()] : [],
        phones: selected && phones.length ? phones : undefined,
        cnpj: selected?.cnpj,
        meta: selected ? { source: "crm_add" } : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não criou o negócio.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-lg border border-white/10 bg-podium-navy p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className={CRM_LABEL}>{COPY.crmAddDeal}</p>
            <h2 className="mt-1 text-base font-semibold">Entrada de lista</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-podium-muted hover:text-podium-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <div ref={wrapRef} className="relative">
            <label className="block">
              <span className={CRM_LABEL}>{COPY.crmCompanyLabel}</span>
              <span className="relative mt-1.5 block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-podium-muted" />
                <input
                  className={cn(CRM_FIELD, "pl-8")}
                  value={company}
                  placeholder={COPY.crmAddDealSearchPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  onChange={(event) => {
                    setCompany(event.target.value);
                    if (!selected) setListOpen(true);
                  }}
                  onFocus={() => {
                    if (!selected) setListOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      setListOpen(false);
                    }
                    if (event.key === "Enter" && showList && hits[0]) {
                      event.preventDefault();
                      pick(hits[0]);
                    }
                  }}
                />
              </span>
            </label>
            {showList ? (
              <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-white/10 bg-podium-panel shadow-xl">
                {search.isFetching && hits.length === 0 ? (
                  <p className="px-2.5 py-2 text-xs text-podium-muted">Buscando…</p>
                ) : hits.length === 0 ? (
                  <p className="px-2.5 py-2 text-xs text-podium-muted">
                    {COPY.crmAddDealNoHits}
                  </p>
                ) : (
                  hits.map((hit) => (
                    <button
                      key={hit.cnpj}
                      type="button"
                      className="block w-full px-2.5 py-2 text-left hover:bg-white/[0.04]"
                      onClick={() => pick(hit)}
                    >
                      <p className="truncate text-xs font-semibold text-podium-white">
                        {displayCompanyName(hit.nomeFantasia, hit.razaoSocial)}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] tabular-nums text-podium-muted">
                        {formatCnpj(hit.cnpj)}
                        {hit.municipio ? ` · ${hit.municipio}/${hit.uf}` : ""}
                        {hit.decisorNome ? ` · ${hit.decisorNome}` : ""}
                      </p>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          {selected ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-podium-yellow/30 bg-podium-yellow/10 px-2 py-1 text-[10px] tabular-nums text-podium-yellow">
                {chipLabel}
                <button
                  type="button"
                  aria-label={COPY.crmUnlinkCompany}
                  onClick={unlink}
                  className="rounded-sm text-podium-yellow/80 hover:text-podium-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
              {phones[0] ? (
                <span className="text-[10px] tabular-nums text-podium-muted">{phones[0]}</span>
              ) : null}
              {!existing ? (
                <button
                  type="button"
                  disabled={pulling}
                  onClick={() => void pullFicha()}
                  className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow hover:text-podium-white disabled:opacity-50"
                >
                  {pulling ? COPY.crmPullFichaLoading : COPY.crmPullFicha}
                </button>
              ) : null}
            </div>
          ) : null}
          {existing ? (
            <p className="text-xs text-podium-yellow">{COPY.crmAddDealAlreadyInPipeline}</p>
          ) : null}
          <label className="block">
            <span className={CRM_LABEL}>{COPY.crmContactLabel}</span>
            <input
              className={cn(CRM_FIELD, "mt-1.5")}
              value={contact}
              onChange={(event) => setContact(event.target.value)}
            />
          </label>
          {socios && socios.length > 0 && !existing ? (
            <div className="flex flex-wrap gap-1.5">
              {socios.map((socio) => (
                <button
                  key={socio.nome}
                  type="button"
                  onClick={() => setContact(socio.nome)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[10px]",
                    contact.trim() === socio.nome
                      ? "border-podium-yellow/50 bg-podium-yellow/15 text-podium-white"
                      : "border-white/10 text-podium-muted hover:border-white/20 hover:text-podium-white",
                  )}
                >
                  {socio.nome}
                  {socio.qualificacao ? (
                    <span className="ml-1 text-podium-muted">{socio.qualificacao}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
          <label className="block">
            <span className={CRM_LABEL}>{COPY.crmSecretaryLabel}</span>
            <input
              className={cn(CRM_FIELD, "mt-1.5")}
              value={secretary}
              onChange={(event) => setSecretary(event.target.value)}
            />
          </label>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="w-full rounded-md bg-podium-yellow py-1.5 text-xs font-medium text-podium-navy hover:brightness-110 disabled:opacity-50"
          >
            {existing ? COPY.crmOpenExistingDeal : COPY.crmAddDeal}
          </button>
        </div>
      </div>
    </div>
  );
}
