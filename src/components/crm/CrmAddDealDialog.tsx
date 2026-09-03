"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePaywall } from "@/components/PaywallDialog";
import { BILLING_ME_QUERY_KEY } from "@/hooks/useBillingMe";
import { isBillingGateError, throwIfBillingGate } from "@/lib/billing/paywall";
import { COPY } from "@/lib/copy";
import {
  dealFieldsFromCompanyHit,
  dealFieldsFromDossier,
  enrichJobIsSettled,
  findDealByCnpj,
  mergeDealPhones,
  reviewBriefingFromDossier,
  type AddDealReviewBriefing,
  type AddDealSelectedCompany,
  type AddDealSocio,
} from "@/lib/crm/add-deal";
import { pickEntradaStage } from "@/lib/crm/cadence";
import { CRM_FIELD, CRM_LABEL, crmFetch } from "@/lib/crm/client";
import type { CrmBoard, CrmPipelineSummary, CrmStage } from "@/lib/crm/types";
import { canSearchCompanies } from "@/lib/data/company-search";
import { displayCompanyName } from "@/lib/enrichment/company-name";
import { formatCnpj } from "@/lib/format";
import { fetchLeadDossier } from "@/lib/lead-query";
import type { CompanySearchHit } from "@/lib/types";
import { cn } from "@/lib/utils";

const ENRICH_POLL_INTERVAL_MS = 1000;
const ENRICH_POLL_TIMEOUT_MS = 25_000;
const EMPTY_STAGES: CrmStage[] = [];
const EMPTY_DEALS: Array<{ id: string; cnpj: string | null }> = [];
const CREATE_PIPELINE_VALUE = "__new__";

export type CrmAddDealInput = {
  pipelineId: string;
  stage_id: string;
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

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function CrmAddDealDialog({
  onClose,
  onCreate,
  onOpenExisting,
  onPipelineCreated,
  pipelines,
  currentPipelineId,
  currentStages,
  currentDeals,
}: {
  onClose: () => void;
  onCreate: (input: CrmAddDealInput) => Promise<void>;
  onOpenExisting: (dealId: string, pipelineId: string) => void;
  onPipelineCreated: (pipeline: CrmPipelineSummary, board: CrmBoard) => void;
  pipelines: CrmPipelineSummary[];
  currentPipelineId: string;
  currentStages: CrmStage[];
  currentDeals: Array<{ id: string; cnpj: string | null }>;
}) {
  const qc = useQueryClient();
  const { openPaywall } = usePaywall();
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [secretary, setSecretary] = useState("");
  const [phones, setPhones] = useState<string[]>([]);
  const [selected, setSelected] = useState<AddDealSelectedCompany | null>(null);
  const [socios, setSocios] = useState<AddDealSocio[] | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pulled, setPulled] = useState(false);
  const [review, setReview] = useState<AddDealReviewBriefing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pipelineId, setPipelineId] = useState(currentPipelineId);
  const [stageId, setStageId] = useState(
    () => pickEntradaStage(currentStages)?.id ?? "",
  );
  const [createdPipelines, setCreatedPipelines] = useState<CrmPipelineSummary[]>(
    [],
  );
  const [creatingPipeline, setCreatingPipeline] = useState(false);
  const [pipelineDraft, setPipelineDraft] = useState("");
  const [creatingPipelineBusy, setCreatingPipelineBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pullGen = useRef(0);
  const createPipelineLock = useRef(false);

  const pipelineOptions = useMemo(() => {
    const byId = new Map(pipelines.map((pipeline) => [pipeline.id, pipeline]));
    for (const pipeline of createdPipelines) byId.set(pipeline.id, pipeline);
    return [...byId.values()];
  }, [createdPipelines, pipelines]);

  const debounced = useDebounced(company, 300);
  const search = useCompanySearch(debounced.trim(), !selected);
  const hits = !selected && canSearchCompanies(debounced.trim()) ? (search.data ?? []) : [];
  const showList = listOpen && !selected && canSearchCompanies(debounced.trim());

  const remoteBoard = useQuery({
    queryKey: ["crm-add-deal-board", pipelineId],
    queryFn: async () => {
      const res = await crmFetch<{ board: CrmBoard }>(
        `/api/crm/pipelines/${pipelineId}`,
      );
      return res.board;
    },
    enabled: pipelineId !== currentPipelineId,
  });

  const stages =
    pipelineId === currentPipelineId
      ? currentStages
      : (remoteBoard.data?.stages ?? EMPTY_STAGES);
  const pipelineDeals =
    pipelineId === currentPipelineId
      ? currentDeals
      : (remoteBoard.data?.deals ?? EMPTY_DEALS);
  const existing = selected ? findDealByCnpj(pipelineDeals, selected.cnpj) : null;

  useEffect(() => {
    const next = pickEntradaStage(stages)?.id ?? "";
    setStageId((current) =>
      stages.some((stage) => stage.id === current) ? current : next,
    );
  }, [stages]);

  function startCreatePipeline() {
    setCreatingPipeline(true);
    setPipelineDraft("");
    setError(null);
  }

  function cancelCreatePipeline() {
    createPipelineLock.current = false;
    setCreatingPipeline(false);
    setPipelineDraft("");
    setCreatingPipelineBusy(false);
  }

  async function submitNewPipeline() {
    if (createPipelineLock.current) return;
    const nome = pipelineDraft.trim();
    if (!nome) {
      cancelCreatePipeline();
      return;
    }
    createPipelineLock.current = true;
    setCreatingPipelineBusy(true);
    setError(null);
    try {
      const res = await crmFetch<{
        pipeline: CrmPipelineSummary;
        board: CrmBoard;
      }>("/api/crm/pipelines", {
        method: "POST",
        body: JSON.stringify({ nome }),
      });
      const created = { ...res.pipeline, deal_count: 0 };
      setCreatedPipelines((current) =>
        current.some((row) => row.id === created.id)
          ? current
          : [...current, created],
      );
      qc.setQueryData(["crm-add-deal-board", created.id], res.board);
      setPipelineId(created.id);
      cancelCreatePipeline();
      onPipelineCreated(created, res.board);
    } catch (err) {
      createPipelineLock.current = false;
      setError(err instanceof Error ? err.message : "Não criou o nicho.");
      setCreatingPipelineBusy(false);
    }
  }

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

  function resetFicha() {
    pullGen.current += 1;
    setPulled(false);
    setReview(null);
    setSocios(null);
    setPulling(false);
  }

  function pick(hit: CompanySearchHit) {
    const fields = dealFieldsFromCompanyHit(hit);
    setCompany(fields.company_name);
    setContact(fields.contact_name);
    setPhones(fields.phones);
    setSelected({
      cnpj: fields.cnpj,
      municipio: fields.municipio,
      uf: fields.uf,
      cnaeDescricao: fields.cnaeDescricao,
    });
    resetFicha();
    setListOpen(false);
    setError(null);
  }

  function unlink() {
    setSelected(null);
    setPhones([]);
    resetFicha();
    setError(null);
    setListOpen(true);
  }

  async function pullFicha() {
    if (!selected || pulling || existing) return;
    const token = ++pullGen.current;
    setPulling(true);
    setError(null);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpjs: [selected.cnpj] }),
      });
      const json = (await res.json()) as { error?: string };
      throwIfBillingGate(res.status, json, openPaywall, "qualify");
      if (!res.ok) {
        throw new Error(json.error ?? "Não qualificou a ficha.");
      }
      if (token !== pullGen.current) return;

      const deadline = Date.now() + ENRICH_POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (token !== pullGen.current) return;
        const poll = await fetch(
          `/api/enrich?cnpj=${encodeURIComponent(selected.cnpj)}`,
        );
        if (poll.ok) {
          const body = (await poll.json()) as { jobStatus?: string | null };
          if (enrichJobIsSettled(body.jobStatus)) break;
        }
        await sleep(ENRICH_POLL_INTERVAL_MS);
      }
      if (token !== pullGen.current) return;

      const dossier = await fetchLeadDossier(selected.cnpj);
      if (token !== pullGen.current) return;
      const extras = dealFieldsFromDossier(dossier);
      setPhones((current) => mergeDealPhones(current, extras.phones));
      setSocios(extras.socios);
      setContact((current) => current.trim() || extras.contact_name);
      setReview(
        reviewBriefingFromDossier(dossier, {
          company,
          municipio: selected.municipio,
          uf: selected.uf,
          cnae: selected.cnaeDescricao,
        }),
      );
      setPulled(true);
      void qc.invalidateQueries({ queryKey: BILLING_ME_QUERY_KEY });
    } catch (err) {
      if (token !== pullGen.current) return;
      if (isBillingGateError(err)) return;
      setError(err instanceof Error ? err.message : "Não foi possível buscar a ficha.");
    } finally {
      if (token === pullGen.current) setPulling(false);
    }
  }

  async function submit() {
    if (existing) {
      onOpenExisting(existing.id, pipelineId);
      return;
    }
    if (!selected) {
      setError(COPY.crmAddDealNeedCompany);
      return;
    }
    if (!pulled) {
      setError(COPY.crmAddDealNeedFicha);
      return;
    }
    if (!pipelineId || !stageId) {
      setError("Escolha o pipeline e a etapa.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        pipelineId,
        stage_id: stageId,
        company_name: company.trim(),
        contact_name: contact.trim(),
        secretaries: secretary.trim() ? [secretary.trim()] : [],
        phones: phones.length ? phones : undefined,
        cnpj: selected.cnpj,
        meta: { source: "crm_add" },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não criou o negócio.");
      setSaving(false);
    }
  }

  const canSubmit =
    !creatingPipeline &&
    (Boolean(existing) ||
      (Boolean(selected) && pulled && Boolean(pipelineId) && Boolean(stageId)));

  const placeLabel = review
    ? [review.municipio, review.uf].filter(Boolean).join("/")
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(92vh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-white/10 bg-podium-navy p-5 shadow-2xl">
        <div className="flex shrink-0 items-start justify-between">
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
        <div className="mt-4 min-h-0 space-y-3 overflow-y-auto pr-0.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={CRM_LABEL}>{COPY.crmPipelineSelectLabel}</span>
              {creatingPipeline ? (
                <input
                  className={cn(CRM_FIELD, "mt-1.5")}
                  value={pipelineDraft}
                  placeholder={COPY.crmNewPipeline}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  disabled={creatingPipelineBusy}
                  onChange={(event) => setPipelineDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submitNewPipeline();
                    }
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      cancelCreatePipeline();
                    }
                  }}
                  onBlur={() => {
                    if (!creatingPipelineBusy) void submitNewPipeline();
                  }}
                />
              ) : (
                <span className="mt-1.5 flex gap-1.5">
                  <select
                    className={cn(CRM_FIELD, "min-w-0 flex-1")}
                    value={pipelineId}
                    onChange={(event) => {
                      if (event.target.value === CREATE_PIPELINE_VALUE) {
                        startCreatePipeline();
                        return;
                      }
                      setPipelineId(event.target.value);
                    }}
                  >
                    <option value={CREATE_PIPELINE_VALUE}>
                      + {COPY.crmNewPipeline}
                    </option>
                    {pipelineOptions.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>
                        {pipeline.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label={COPY.crmNewPipeline}
                    onClick={startCreatePipeline}
                    className="inline-flex shrink-0 items-center justify-center rounded-md border border-white/10 px-2 text-podium-muted hover:border-podium-yellow/40 hover:text-podium-yellow"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </label>
            <label className="block">
              <span className={CRM_LABEL}>{COPY.crmStageSelectLabel}</span>
              <select
                className={cn(CRM_FIELD, "mt-1.5")}
                value={stageId}
                disabled={creatingPipeline || stages.length === 0}
                onChange={(event) => setStageId(event.target.value)}
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
              {!existing && !pulled ? (
                <button
                  type="button"
                  disabled={pulling}
                  onClick={() => void pullFicha()}
                  className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow hover:text-podium-white disabled:opacity-50"
                >
                  {pulling ? COPY.crmPullFichaLoading : COPY.crmPullFicha}
                  <span className="ml-1.5 font-normal normal-case tracking-normal text-podium-muted">
                    · {COPY.crmPullFichaCredit}
                  </span>
                </button>
              ) : null}
              {!existing && pulled ? (
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                  {COPY.crmPullFichaDone}
                </span>
              ) : null}
            </div>
          ) : null}
          {!existing && selected && !pulled ? (
            <p className="text-[11px] text-podium-muted">{COPY.crmPullFichaHint}</p>
          ) : null}
          {existing ? (
            <p className="text-xs text-podium-yellow">{COPY.crmAddDealAlreadyInPipeline}</p>
          ) : null}
          {review && pulled && !existing ? (
            <div className="rounded-md border border-white/10 bg-podium-panel/60 p-3">
              <p className={CRM_LABEL}>{COPY.crmAddDealReview}</p>
              <p className="mt-1.5 text-sm font-semibold text-podium-white">
                {review.company || company}
              </p>
              <p className="mt-0.5 text-[11px] tabular-nums text-podium-muted">
                {formatCnpj(review.cnpj)}
                {placeLabel ? ` · ${placeLabel}` : ""}
              </p>
              {review.cnae ? (
                <p className="mt-1 text-[11px] text-podium-muted">
                  <span className="uppercase tracking-[0.12em]">{COPY.crmAddDealCnae}</span>
                  {" · "}
                  {review.cnae}
                </p>
              ) : null}
              {review.phones.length ? (
                <p className="mt-1 text-[11px] tabular-nums text-podium-white">
                  {review.phones.slice(0, 3).join(" · ")}
                </p>
              ) : null}
              {review.contact ? (
                <p className="mt-1 text-[11px] text-podium-white">{review.contact}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {review.badges.map((badge) => (
                  <span
                    key={badge.id}
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                      badge.found
                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                        : "border-white/10 text-podium-muted",
                    )}
                  >
                    {badge.label} · {badge.found ? "ok" : "falta"}
                  </span>
                ))}
              </div>
            </div>
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
          {remoteBoard.isError ? (
            <p className="text-xs text-red-400">Não carregou as etapas deste nicho.</p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={saving || creatingPipelineBusy || !canSubmit}
          onClick={() => void submit()}
          className="mt-4 w-full shrink-0 rounded-md bg-podium-yellow py-1.5 text-xs font-medium text-podium-navy hover:brightness-110 disabled:opacity-50"
        >
          {existing ? COPY.crmOpenExistingDeal : COPY.crmAddDeal}
        </button>
      </div>
    </div>
  );
}
