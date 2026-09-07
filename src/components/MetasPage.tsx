"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SectionTitle } from "@/components/SectionTitle";
import { Button, buttonClassName } from "@/components/ui/Button";
import type { MetasPayload } from "@/lib/calculadora/payload";
import {
  calculateFunnel,
  DEFAULT_TAXAS,
  type FunnelPlan,
} from "@/lib/calculadora/funnel";
import {
  defaultMetaInput,
  funnelFromMeta,
  sortMetasForList,
  type MetaInput,
  type PilotMeta,
} from "@/lib/calculadora/meta";
import type { CrmRateSample, CrmRateSuggestions } from "@/lib/calculadora/crm-rates";
import {
  eachTen,
  formatBrl,
  formatBrlForEdit,
  maskBrlTyping,
  reaisFromBrlMask,
} from "@/lib/calculadora/money";
import { CALCULADORA_GLOSSARIO, COPY } from "@/lib/copy";
import { invalidateLiveStats } from "@/lib/live-stats";
import { cn } from "@/lib/utils";
import {
  workSplitClass,
  workSplitPaneClass,
  workSplitRailClass,
} from "@/lib/work-split";

const fieldClass =
  "mt-1 min-h-11 w-full rounded-md border border-white/10 bg-podium-panel px-2.5 py-1.5 text-base outline-none focus:border-podium-yellow/40 md:min-h-0 md:text-sm";

const METAS_QUERY = ["metas"] as const;

function formatInt(n: number): string {
  return n.toLocaleString("pt-BR");
}

function metaToInput(meta: PilotMeta): MetaInput {
  return {
    nome: meta.nome,
    tipo_empresa: meta.tipo_empresa,
    metaFaturamento: meta.metaFaturamento,
    ticket: meta.ticket,
    prazoMeses: meta.prazoMeses,
    taxa1: meta.taxa1,
    taxa2: meta.taxa2,
    taxa3: meta.taxa3,
    taxa4: meta.taxa4,
    taxasOrigem: meta.taxasOrigem,
  };
}

function CrmChip({ sample, title }: { sample: CrmRateSample | null; title: string }) {
  if (!sample) return null;
  return (
    <span
      title={title}
      className="cursor-help rounded-md border border-podium-yellow/30 bg-podium-yellow/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow"
    >
      CRM · {sample.numerador}/{sample.denominador}
    </span>
  );
}

function PlanoFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-podium-white">{value}</p>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  featured = false,
}: {
  label: string;
  value: number;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        featured
          ? "border-podium-yellow/40 bg-podium-yellow/10"
          : "border-white/[0.08] bg-white/[0.03]",
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold",
          featured ? "text-podium-yellow" : "text-podium-white",
        )}
      >
        {formatInt(value)}
      </p>
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (reais: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<"select" | "end">("select");
  const display = focused ? draft : formatBrl(value);

  useLayoutEffect(() => {
    if (!focused) return;
    const el = inputRef.current;
    if (!el) return;
    if (caretRef.current === "select") {
      el.select();
      return;
    }
    const pos = el.value.length;
    el.setSelectionRange(pos, pos);
  }, [draft, focused]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="R$ 0,00"
      value={display}
      onFocus={() => {
        caretRef.current = "select";
        setFocused(true);
        setDraft(value > 0 ? formatBrlForEdit(value) : "");
      }}
      onChange={(e) => {
        caretRef.current = "end";
        const next = maskBrlTyping(e.target.value);
        setDraft(next);
        onChange(reaisFromBrlMask(next));
      }}
      onBlur={() => {
        setFocused(false);
      }}
      className={fieldClass}
    />
  );
}

function MetaPickCard({
  title,
  subtitle,
  detail,
  selected,
  onBox,
  draft = false,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  detail?: string;
  selected: boolean;
  onBox?: boolean;
  draft?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition disabled:cursor-default",
        selected
          ? "border-podium-yellow/40 bg-podium-yellow/10"
          : draft
            ? "border-dashed border-white/20 bg-white/[0.02]"
            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-podium-white">
          {title}
        </span>
        <span className="block truncate text-[11px] text-podium-muted">
          {[subtitle, detail].filter(Boolean).join(" · ")}
        </span>
      </span>
      {onBox ? (
        <span className="shrink-0 rounded-md border border-podium-yellow/40 bg-podium-yellow/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          {COPY.metasNoBox}
        </span>
      ) : null}
    </button>
  );
}

function PercentInput({
  value,
  fallback,
  onChange,
}: {
  value: number;
  fallback: number;
  onChange: (percent: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const display = focused ? draft : String(value);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onFocus={(e) => {
          setFocused(true);
          setDraft(String(value));
          e.target.select();
        }}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
          setDraft(digits);
          onChange(digits ? Number(digits) : 0);
        }}
        onBlur={() => {
          setFocused(false);
          if (value < 1) onChange(fallback);
          else if (value > 100) onChange(100);
        }}
        className={cn(fieldClass, "pr-9")}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-podium-yellow">
        %
      </span>
    </div>
  );
}

async function readPayload(res: Response): Promise<MetasPayload> {
  const json = (await res.json()) as MetasPayload & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "save");
  return json;
}

export function MetasPage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: METAS_QUERY,
    queryFn: async () => {
      const res = await fetch("/api/metas");
      if (!res.ok) throw new Error("load");
      return (await res.json()) as MetasPayload;
    },
  });
  const [draft, setDraft] = useState<MetaInput>(defaultMetaInput);
  const draftRef = useRef(draft);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef(selectedId);
  const [hydrated, setHydrated] = useState(false);
  const [justApplied, setJustApplied] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PilotMeta | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!query.data || hydrated) return;
    const { metas, activeMetaId } = query.data;
    const initial =
      metas.find((row) => row.id === activeMetaId) ?? metas[0] ?? null;
    if (initial) {
      const next = metaToInput(initial);
      draftRef.current = next;
      setDraft(next);
      setSelectedId(initial.id);
    }
    setHydrated(true);
  }, [query.data, hydrated]);

  const suggestions = query.data?.suggestions;
  const activeMetaId = query.data?.activeMetaId ?? null;
  const metas = useMemo(
    () => sortMetasForList(query.data?.metas ?? [], activeMetaId),
    [query.data?.metas, activeMetaId],
  );
  const result = useMemo(
    () => calculateFunnel(funnelFromMeta(draft)),
    [draft],
  );
  const activeOnBox = Boolean(selectedId && selectedId === activeMetaId);

  function setCache(data: MetasPayload) {
    qc.setQueryData(METAS_QUERY, data);
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  const save = useMutation({
    mutationFn: async (opts: { apply?: boolean; list?: boolean } = {}) => {
      const current = draftRef.current;
      if (!current.nome.trim()) {
        if (opts.apply || opts.list) throw new Error(COPY.metasNeedNome);
        return null;
      }
      let id = selectedIdRef.current;
      if (!id) {
        const res = await fetch("/api/metas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(current),
        });
        const json = (await res.json()) as MetasPayload & {
          meta?: PilotMeta;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "save");
        id = json.meta?.id ?? null;
        if (!id) throw new Error("save");
        selectedIdRef.current = id;
        setSelectedId(id);
        if (opts.apply) {
          const applied = await fetch(`/api/metas/${id}/apply`, { method: "POST" });
          return readPayload(applied);
        }
        return json;
      }
      const patched = await fetch(`/api/metas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current),
      });
      const saved = await readPayload(patched);
      if (!opts.apply) return saved;
      const applied = await fetch(`/api/metas/${id}/apply`, { method: "POST" });
      return readPayload(applied);
    },
    onSuccess: (data, vars) => {
      if (!data) return;
      setCache(data);
      if (vars.apply) void invalidateLiveStats(qc);
      const currentId = selectedIdRef.current;
      const selected = data.metas.find((row) => row.id === currentId);
      if (selected) {
        const next = metaToInput(selected);
        draftRef.current = next;
        setDraft(next);
      }
      setJustApplied(Boolean(vars.apply));
      if (vars.list) {
        setJustSaved(true);
        requestAnimationFrame(() => {
          document.getElementById("suas-metas")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      }
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/metas/${id}`, { method: "DELETE" });
      return readPayload(res);
    },
    onSuccess: (data, id) => {
      setCache(data);
      setPendingDelete(null);
      if (selectedIdRef.current !== id) return;
      const nextMeta =
        data.metas.find((row) => row.id === data.activeMetaId) ?? data.metas[0];
      if (nextMeta) {
        const next = metaToInput(nextMeta);
        draftRef.current = next;
        setDraft(next);
        selectedIdRef.current = nextMeta.id;
        setSelectedId(nextMeta.id);
      } else {
        startNew();
      }
    },
  });

  function patch(
    partial: Partial<MetaInput>,
    origem?: FunnelPlan["taxasOrigem"],
  ) {
    setJustApplied(false);
    setJustSaved(false);
    const next = {
      ...draftRef.current,
      ...partial,
      taxasOrigem: origem ?? draftRef.current.taxasOrigem,
    };
    draftRef.current = next;
    setDraft(next);
  }

  function selectMeta(meta: PilotMeta) {
    setJustApplied(false);
    setJustSaved(false);
    const next = metaToInput(meta);
    draftRef.current = next;
    setDraft(next);
    selectedIdRef.current = meta.id;
    setSelectedId(meta.id);
  }

  function startNew() {
    setJustApplied(false);
    setJustSaved(false);
    const next = defaultMetaInput();
    draftRef.current = next;
    setDraft(next);
    selectedIdRef.current = null;
    setSelectedId(null);
  }

  function applyCrmRates(next: CrmRateSuggestions) {
    setJustApplied(false);
    setJustSaved(false);
    const updated = {
      ...draftRef.current,
      taxa1: next.taxa1?.percent ?? draftRef.current.taxa1,
      taxa2: next.taxa2?.percent ?? draftRef.current.taxa2,
      taxa3: next.taxa3?.percent ?? draftRef.current.taxa3,
      taxa4: next.taxa4?.percent ?? draftRef.current.taxa4,
      taxasOrigem: "crm" as const,
    };
    draftRef.current = updated;
    setDraft(updated);
  }

  function applyDefaultRates() {
    setJustApplied(false);
    setJustSaved(false);
    const updated = {
      ...draftRef.current,
      taxa1: DEFAULT_TAXAS.taxa1,
      taxa2: DEFAULT_TAXAS.taxa2,
      taxa3: DEFAULT_TAXAS.taxa3,
      taxa4: DEFAULT_TAXAS.taxa4,
      taxasOrigem: "padrao" as const,
    };
    draftRef.current = updated;
    setDraft(updated);
  }

  const hasCrmRates = Boolean(
    suggestions?.taxa1 ||
      suggestions?.taxa2 ||
      suggestions?.taxa3 ||
      suggestions?.taxa4,
  );

  if (query.isError) {
    return <p className="text-sm text-podium-gray">{COPY.metasLoadError}</p>;
  }

  if (query.isLoading || !hydrated) {
    return <p className="text-sm text-podium-muted">Carregando…</p>;
  }

  const ctaLabel = COPY.calculadoraCta.replace(
    "{n}",
    formatInt(result.ligacoesPorDia),
  );
  const persistError = save.error ?? remove.error;

  return (
    <div className={workSplitClass}>
      <div className={workSplitRailClass}>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={startNew}
            className={buttonClassName({
              variant: "accent",
              size: "sm",
              className: "ml-auto",
            })}
          >
            <Plus className="h-3.5 w-3.5" />
            {COPY.metasNova}
          </button>
        </div>
        <div id="suas-metas" className="mt-2 min-h-0 flex-1 space-y-1">
          {metas.length === 0 && selectedId !== null ? (
            <p className="px-1 py-6 text-sm text-podium-muted">{COPY.metasEmpty}</p>
          ) : (
            <>
              {metas.map((meta) => {
                const daily = calculateFunnel(funnelFromMeta(meta)).ligacoesPorDia;
                const selected = meta.id === selectedId;
                const onBox = meta.id === activeMetaId;
                return (
                  <MetaPickCard
                    key={meta.id}
                    title={meta.nome}
                    subtitle={meta.tipo_empresa || undefined}
                    detail={`${formatBrl(meta.ticket)} · ${formatInt(daily)} lig/dia`}
                    selected={selected}
                    onBox={onBox}
                    onSelect={() => selectMeta(meta)}
                  />
                );
              })}
              {selectedId === null ? (
                <MetaPickCard
                  title={draft.nome.trim() || COPY.metasNova}
                  subtitle={draft.tipo_empresa.trim() || undefined}
                  detail={COPY.metasRascunho}
                  selected
                  draft
                />
              ) : null}
            </>
          )}
        </div>
      </div>

      <div id="meta-funil" className={cn(workSplitPaneClass, "space-y-3")}>
          <GlassCard className="p-3" hover={false}>
            <SectionTitle>{COPY.calculadoraObjetivo}</SectionTitle>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-podium-gray">
                {COPY.metasNome}
                <input
                  type="text"
                  maxLength={80}
                  value={draft.nome}
                  onChange={(e) => patch({ nome: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm text-podium-gray">
                {COPY.metasTipoEmpresa}
                <input
                  type="text"
                  maxLength={80}
                  value={draft.tipo_empresa}
                  onChange={(e) => patch({ tipo_empresa: e.target.value })}
                  className={fieldClass}
                />
              </label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block text-sm text-podium-gray">
                {COPY.calculadoraMetaFaturamento}
                <MoneyInput
                  value={draft.metaFaturamento}
                  onChange={(metaFaturamento) => patch({ metaFaturamento })}
                />
              </label>
              <label className="block text-sm text-podium-gray">
                <span className="flex items-center justify-between gap-2">
                  {COPY.calculadoraTicket}
                  {suggestions?.ticket ? (
                    <span
                      title={COPY.calculadoraCrmTicketTip.replace(
                        "{n}",
                        String(suggestions.ticket.amostra),
                      )}
                      className="cursor-help rounded-md border border-podium-yellow/30 bg-podium-yellow/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow"
                    >
                      CRM · {suggestions.ticket.amostra}
                    </span>
                  ) : null}
                </span>
                <MoneyInput
                  value={draft.ticket}
                  onChange={(ticket) => patch({ ticket })}
                />
                {suggestions?.ticket ? (
                  <button
                    type="button"
                    className="mt-1.5 text-xs font-medium text-podium-yellow"
                    title={COPY.calculadoraCrmTicketTip.replace(
                      "{n}",
                      String(suggestions.ticket.amostra),
                    )}
                    onClick={() => {
                      patch({ ticket: suggestions.ticket!.reais });
                    }}
                  >
                    {COPY.calculadoraUsarTicketCrm} (
                    {formatBrl(suggestions.ticket.reais)})
                  </button>
                ) : null}
              </label>
              <label className="block text-sm text-podium-gray">
                {COPY.calculadoraPrazo}
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draft.prazoMeses || ""}
                  onChange={(e) =>
                    patch({ prazoMeses: Number(e.target.value) || 0 })
                  }
                  className={fieldClass}
                />
              </label>
            </div>
          </GlassCard>

          <details className="group rounded-md border border-white/10 bg-white/[0.04] open:border-podium-yellow/25">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-podium-white [&::-webkit-details-marker]:hidden">
              <span>{COPY.calculadoraTaxas}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-podium-muted transition group-open:rotate-180 group-open:text-podium-yellow" />
            </summary>
            <div className="space-y-3 px-3 pb-3">
              {hasCrmRates ? (
                <button
                  type="button"
                  title={
                    draft.taxasOrigem === "crm"
                      ? COPY.calculadoraUsarPadraoTip
                      : COPY.calculadoraUsarCrmTip
                  }
                  className={buttonClassName({ variant: "accent", size: "sm" })}
                  onClick={() => {
                    if (draft.taxasOrigem === "crm") {
                      applyDefaultRates();
                    } else if (suggestions) {
                      applyCrmRates(suggestions);
                    }
                  }}
                >
                  {draft.taxasOrigem === "crm"
                    ? COPY.calculadoraUsarPadrao
                    : COPY.calculadoraUsarCrm}
                </button>
              ) : null}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {(
                [
                  [
                    "taxa1",
                    COPY.calculadoraTaxa1,
                    COPY.calculadoraTaxa1Hint,
                    suggestions?.taxa1,
                    DEFAULT_TAXAS.taxa1,
                  ],
                  [
                    "taxa2",
                    COPY.calculadoraTaxa2,
                    COPY.calculadoraTaxa2Hint,
                    suggestions?.taxa2,
                    DEFAULT_TAXAS.taxa2,
                  ],
                  [
                    "taxa3",
                    COPY.calculadoraTaxa3,
                    COPY.calculadoraTaxa3Hint,
                    suggestions?.taxa3,
                    DEFAULT_TAXAS.taxa3,
                  ],
                  [
                    "taxa4",
                    COPY.calculadoraTaxa4,
                    COPY.calculadoraTaxa4Hint,
                    suggestions?.taxa4,
                    DEFAULT_TAXAS.taxa4,
                  ],
                ] as const
              ).map(([key, label, hint, sample, fallback]) => (
                <label key={key} className="block text-sm text-podium-gray">
                  <span className="flex items-center justify-between gap-2">
                    {label}
                    <CrmChip
                      sample={sample ?? null}
                      title={
                        sample
                          ? COPY.calculadoraCrmTaxaTip
                              .replace("{n}", String(sample.numerador))
                              .replace("{d}", String(sample.denominador))
                          : ""
                      }
                    />
                  </span>
                  <PercentInput
                    value={draft[key]}
                    fallback={fallback}
                    onChange={(percent) => patch({ [key]: percent }, "manual")}
                  />
                  <Hint className="mt-1">
                    {hint.replace("{n}", eachTen(draft[key] || fallback))}
                  </Hint>
                </label>
              ))}
            </div>
            </div>
          </details>

          <GlassCard className="p-3" hover={false}>
            <SectionTitle>{COPY.calculadoraFunil}</SectionTitle>
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
              <FunnelStep
                label={COPY.calculadoraPassoContratos}
                value={result.contratos}
                featured
              />
              <FunnelStep
                label={COPY.calculadoraPassoNegociacoes}
                value={result.negociacoes}
              />
              <FunnelStep label={COPY.calculadoraPassoR2} value={result.r2} />
              <FunnelStep label={COPY.calculadoraPassoR1} value={result.r1} />
              <FunnelStep
                label={COPY.calculadoraPassoDecisor}
                value={result.ligacoesDecisor}
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={!draft.nome.trim() || save.isPending}
                onClick={() => save.mutate({ list: true })}
              >
                {COPY.metasSalvar}
              </Button>
              {selectedId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => {
                    const meta = metas.find((row) => row.id === selectedId);
                    if (meta) setPendingDelete(meta);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {COPY.metasExcluir}
                </Button>
              ) : null}
            </div>
            <Hint className="mt-3">{COPY.metasSalvarHint}</Hint>
            {justSaved ? (
              <p className="mt-2 text-sm font-bold text-podium-yellow">
                {COPY.metasSalva}
              </p>
            ) : null}
            {persistError ? (
              <p className="mt-3 text-sm text-red-400">
                {persistError instanceof Error
                  ? persistError.message
                  : "Não foi possível salvar."}
              </p>
            ) : null}
          </GlassCard>

          <GlassCard className="p-3" highlight hover={false}>
            <SectionTitle>{COPY.calculadoraPlano}</SectionTitle>
            <div className="mt-3 rounded-md border border-podium-yellow/40 bg-podium-yellow/10 px-3 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                {COPY.calculadoraPorDia}
              </p>
              <p className="mt-1 text-xl font-semibold text-podium-yellow">
                {formatInt(result.ligacoesPorDia)}
              </p>
              <p className="mt-2 text-sm text-podium-gray">
                {COPY.calculadoraPlanoHero}
              </p>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <PlanoFact
                label={COPY.calculadoraPlanoHoje}
                value={COPY.calculadoraPlanoHojeValue.replace(
                  "{n}",
                  formatInt(result.ligacoesPorDia),
                )}
              />
              <PlanoFact
                label={COPY.calculadoraPlanoPeriodo}
                value={COPY.calculadoraPlanoPeriodoValue
                  .replace("{totais}", formatInt(result.ligacoesTotais))
                  .replace("{decisor}", formatInt(result.ligacoesDecisor))}
              />
              <PlanoFact
                label={COPY.calculadoraPlanoPrazo}
                value={
                  result.ready && result.dataFinal
                    ? `${result.dataFinal.toLocaleDateString("pt-BR")} · ${formatInt(result.semanas)} sem. · ${formatInt(result.diasProspeccao)} dias`
                    : COPY.calculadoraCtaNeed
                }
              />
            </div>
            <details className="group mt-3 rounded-md border border-white/10 bg-white/[0.04] open:border-podium-yellow/25">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-podium-white [&::-webkit-details-marker]:hidden">
                <span>{COPY.calculadoraPlanoComo}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-podium-muted transition group-open:rotate-180 group-open:text-podium-yellow" />
              </summary>
              <div className="space-y-2 px-4 pb-4 text-sm leading-relaxed text-podium-gray">
                <p>{COPY.calculadoraPlanoComoTotais}</p>
                <p>{COPY.calculadoraPlanoComoDia}</p>
                {result.ready && result.dataFinal ? (
                  <p>
                    {formatBrl(draft.metaFaturamento)} em {draft.prazoMeses}{" "}
                    {draft.prazoMeses === 1 ? "mês" : "meses"}.
                  </p>
                ) : null}
              </div>
            </details>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={!result.ready || save.isPending}
                onClick={() => save.mutate({ apply: true })}
              >
                {result.ready ? ctaLabel : COPY.calculadoraCtaNeed}
              </Button>
              {justApplied || activeOnBox ? (
                <Link
                  href="/box"
                  className={buttonClassName({ variant: "secondary", size: "md" })}
                >
                  {COPY.calculadoraOpenBox}
                </Link>
              ) : null}
            </div>
            {justApplied ? (
              <p className="mt-3 text-sm font-bold text-podium-yellow">
                {COPY.calculadoraApplied}
              </p>
            ) : null}
          </GlassCard>

      <details className="group rounded-md border border-white/10 bg-white/[0.04] open:border-podium-yellow/25">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-podium-white [&::-webkit-details-marker]:hidden">
          <span>{COPY.calculadoraGlossario}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-podium-muted transition group-open:rotate-180 group-open:text-podium-yellow" />
        </summary>
        <div className="space-y-2 px-3 pb-3">
          <Hint>{COPY.calculadoraGlossarioLead}</Hint>
          {CALCULADORA_GLOSSARIO.map((item) => (
            <div key={item.id} className="rounded-md border border-white/10 px-3 py-2">
              <p className="text-sm font-semibold text-podium-white">{item.title}</p>
              <p className="mt-1 text-pretty text-sm leading-relaxed text-podium-gray">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </details>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={COPY.metasConfirmDeleteTitle.replace(
          "{nome}",
          pendingDelete?.nome ?? "",
        )}
        body={COPY.metasConfirmDelete}
        confirmLabel={COPY.metasDeleteConfirm}
        pendingLabel={COPY.metasDeletePending}
        pending={remove.isPending}
        onClose={() => {
          if (remove.isPending) return;
          setPendingDelete(null);
        }}
        onConfirm={() => {
          if (!pendingDelete) return;
          remove.mutate(pendingDelete.id);
        }}
      />
    </div>
  );
}
