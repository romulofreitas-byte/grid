"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SectionTitle } from "@/components/SectionTitle";
import type { MetasPayload } from "@/lib/calculadora/payload";
import {
  calculateFunnel,
  DEFAULT_TAXAS,
  type FunnelPlan,
} from "@/lib/calculadora/funnel";
import {
  defaultMetaInput,
  funnelFromMeta,
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
import { cn } from "@/lib/utils";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 outline-none focus:border-podium-yellow/40";

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

function CrmChip({ sample }: { sample: CrmRateSample | null }) {
  if (!sample) return null;
  return (
    <span className="rounded-full border border-podium-yellow/30 bg-podium-yellow/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-podium-yellow">
      CRM · {sample.numerador}/{sample.denominador}
    </span>
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
        "rounded-xl border px-3 py-3",
        featured
          ? "border-podium-yellow/40 bg-podium-yellow/10"
          : "border-white/[0.08] bg-white/[0.03]",
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-extrabold",
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
  onBlur,
}: {
  value: number;
  onChange: (reais: number) => void;
  onBlur: () => void;
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
        onBlur();
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
  onApply,
  onDelete,
  applyDisabled,
}: {
  title: string;
  subtitle?: string;
  detail?: string;
  selected: boolean;
  onBox?: boolean;
  draft?: boolean;
  onSelect?: () => void;
  onApply?: () => void;
  onDelete?: () => void;
  applyDisabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-xl border text-left",
        selected
          ? "border-podium-yellow/40 bg-podium-yellow/10"
          : draft
            ? "border-dashed border-white/20 bg-white/[0.02]"
            : "border-white/[0.08] bg-white/[0.03]",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={!onSelect}
        className="min-w-0 flex-1 px-3 py-3 text-left disabled:cursor-default"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-extrabold text-podium-white">
            {title}
          </p>
          {onBox ? (
            <span className="shrink-0 rounded-full border border-podium-yellow/40 bg-podium-yellow/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-podium-yellow">
              {COPY.metasNoBox}
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-podium-gray">{subtitle}</p>
        ) : null}
        {detail ? (
          <p className="mt-1 text-xs text-podium-muted">{detail}</p>
        ) : null}
      </button>
      {onApply || onDelete ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.06] px-3 py-2">
          {onApply ? (
            <button
              type="button"
              disabled={applyDisabled}
              onClick={onApply}
              className="text-[11px] font-bold text-podium-yellow disabled:cursor-not-allowed disabled:opacity-40"
            >
              {COPY.metasUsarNoBox}
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-podium-muted hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
              {COPY.metasExcluir}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PercentInput({
  value,
  fallback,
  onChange,
  onBlur,
}: {
  value: number;
  fallback: number;
  onChange: (percent: number) => void;
  onBlur: () => void;
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
          onBlur();
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
  const metas = query.data?.metas ?? [];
  const activeMetaId = query.data?.activeMetaId ?? null;
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
    mutationFn: async (opts: { apply?: boolean } = {}) => {
      const current = draftRef.current;
      if (!current.nome.trim()) {
        if (opts.apply) throw new Error(COPY.metasNeedNome);
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
      const currentId = selectedIdRef.current;
      const selected = data.metas.find((row) => row.id === currentId);
      if (selected) {
        const next = metaToInput(selected);
        draftRef.current = next;
        setDraft(next);
      }
      setJustApplied(Boolean(vars.apply));
    },
  });

  const applyExisting = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/metas/${id}/apply`, { method: "POST" });
      return readPayload(res);
    },
    onSuccess: (data, id) => {
      setCache(data);
      const selected = data.metas.find((row) => row.id === id);
      if (selected) selectMeta(selected);
      setJustApplied(true);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/metas/${id}`, { method: "DELETE" });
      return readPayload(res);
    },
    onSuccess: (data, id) => {
      setCache(data);
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
    const next = metaToInput(meta);
    draftRef.current = next;
    setDraft(next);
    selectedIdRef.current = meta.id;
    setSelectedId(meta.id);
  }

  function startNew() {
    setJustApplied(false);
    const next = defaultMetaInput();
    draftRef.current = next;
    setDraft(next);
    selectedIdRef.current = null;
    setSelectedId(null);
  }

  function applyCrmRates(next: CrmRateSuggestions) {
    setJustApplied(false);
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
  const persistError =
    save.error ?? applyExisting.error ?? remove.error;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-yellow">
          {COPY.calculadoraEyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">
          {COPY.calculadoraTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-podium-gray md:text-base">
          {COPY.calculadoraLead}
        </p>
      </div>

      <GlassCard className="p-5 md:p-6" hover={false}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionTitle>{COPY.metasLista}</SectionTitle>
            {metas.length > 0 ? (
              <Hint className="mt-1">{COPY.metasListaHint}</Hint>
            ) : null}
          </div>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-1 rounded-lg border border-podium-yellow/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-podium-yellow"
          >
            <Plus className="h-3.5 w-3.5" />
            {COPY.metasNova}
          </button>
        </div>
        {metas.length === 0 ? (
          <p className="mt-4 text-sm text-podium-muted">{COPY.metasEmpty}</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {selectedId === null ? (
              <MetaPickCard
                title={draft.nome.trim() || COPY.metasNova}
                subtitle={draft.tipo_empresa.trim() || undefined}
                detail={COPY.metasRascunho}
                selected
                draft
              />
            ) : null}
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
                  onApply={
                    onBox ? undefined : () => applyExisting.mutate(meta.id)
                  }
                  applyDisabled={daily < 1 || applyExisting.isPending}
                  onDelete={
                    remove.isPending
                      ? undefined
                      : () => {
                          if (!window.confirm(COPY.metasConfirmDelete)) return;
                          remove.mutate(meta.id);
                        }
                  }
                />
              );
            })}
          </div>
        )}
      </GlassCard>

      <div id="meta-funil" className="flex flex-col gap-6">
          <GlassCard className="p-5 md:p-6" hover={false}>
            <SectionTitle>{COPY.calculadoraObjetivo}</SectionTitle>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-podium-gray">
                {COPY.metasNome}
                <input
                  type="text"
                  maxLength={80}
                  value={draft.nome}
                  onChange={(e) => patch({ nome: e.target.value })}
                  onBlur={() => save.mutate({})}
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
                  onBlur={() => save.mutate({})}
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
                  onBlur={() => save.mutate({})}
                />
              </label>
              <label className="block text-sm text-podium-gray">
                <span className="flex items-center justify-between gap-2">
                  {COPY.calculadoraTicket}
                  {suggestions?.ticket ? (
                    <span className="rounded-full border border-podium-yellow/30 bg-podium-yellow/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-podium-yellow">
                      CRM · {suggestions.ticket.amostra}
                    </span>
                  ) : null}
                </span>
                <MoneyInput
                  value={draft.ticket}
                  onChange={(ticket) => patch({ ticket })}
                  onBlur={() => save.mutate({})}
                />
                {suggestions?.ticket ? (
                  <button
                    type="button"
                    className="mt-1.5 text-xs font-bold text-podium-yellow"
                    onClick={() => {
                      patch({ ticket: suggestions.ticket!.reais });
                      save.mutate({});
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
                  onBlur={() => save.mutate({})}
                  className={fieldClass}
                />
              </label>
            </div>
          </GlassCard>

          <GlassCard className="p-5 md:p-6" hover={false}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle>{COPY.calculadoraTaxas}</SectionTitle>
              {hasCrmRates ? (
                <button
                  type="button"
                  className="rounded-xl border border-podium-yellow/40 px-3 py-1.5 text-xs font-bold text-podium-yellow"
                  onClick={() => {
                    if (!suggestions) return;
                    applyCrmRates(suggestions);
                    save.mutate({});
                  }}
                >
                  {COPY.calculadoraUsarCrm}
                </button>
              ) : null}
            </div>
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
                    <CrmChip sample={sample ?? null} />
                  </span>
                  <PercentInput
                    value={draft[key]}
                    fallback={fallback}
                    onChange={(percent) => patch({ [key]: percent }, "manual")}
                    onBlur={() => save.mutate({})}
                  />
                  <Hint className="mt-1">
                    {hint.replace("{n}", eachTen(draft[key] || fallback))}
                  </Hint>
                </label>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5 md:p-6" hover={false}>
            <SectionTitle>{COPY.calculadoraFunil}</SectionTitle>
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
              <FunnelStep
                label={COPY.calculadoraPassoContratos}
                value={result.contratos}
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
                featured
              />
            </div>
          </GlassCard>

          <GlassCard className="p-5 md:p-6" highlight hover={false}>
            <SectionTitle>{COPY.calculadoraPlano}</SectionTitle>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <FunnelStep
                label={COPY.calculadoraTotais}
                value={result.ligacoesTotais}
              />
              <FunnelStep
                label={COPY.calculadoraDecisor}
                value={result.ligacoesDecisor}
              />
              <FunnelStep
                label={COPY.calculadoraPorDia}
                value={result.ligacoesPorDia}
                featured
              />
            </div>
            <Hint className="mt-4">{COPY.calculadoraPremissas}</Hint>
            {result.ready && result.dataFinal ? (
              <p className="mt-2 text-sm text-podium-gray">
                {formatBrl(draft.metaFaturamento)} em {draft.prazoMeses}{" "}
                {draft.prazoMeses === 1 ? "mês" : "meses"}, até{" "}
                {result.dataFinal.toLocaleDateString("pt-BR")}. {result.semanas}{" "}
                semanas · {result.diasProspeccao} dias de prospecção.
              </p>
            ) : (
              <p className="mt-2 text-sm text-podium-muted">
                {COPY.calculadoraCtaNeed}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!result.ready || save.isPending}
                onClick={() => save.mutate({ apply: true })}
                className="rounded-xl bg-podium-yellow px-6 py-3 text-sm font-extrabold text-podium-navy transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {result.ready ? ctaLabel : COPY.calculadoraCtaNeed}
              </button>
              {justApplied || activeOnBox ? (
                <Link
                  href="/box"
                  className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow"
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
            {persistError ? (
              <p className="mt-3 text-sm text-red-400">
                {persistError instanceof Error
                  ? persistError.message
                  : "Não foi possível salvar."}
              </p>
            ) : null}
          </GlassCard>
      </div>

      <GlassCard className="p-5 md:p-6" hover={false}>
        <SectionTitle>{COPY.calculadoraGlossario}</SectionTitle>
        <Hint className="mt-2">{COPY.calculadoraGlossarioLead}</Hint>
        <div className="mt-4 space-y-2">
          {CALCULADORA_GLOSSARIO.map((item, index) => (
            <details
              key={item.id}
              open={index === 0}
              className="group rounded-xl border border-white/10 bg-white/[0.04] open:border-podium-yellow/25"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-podium-white [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 text-balance">{item.title}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-podium-muted transition group-open:rotate-180 group-open:text-podium-yellow" />
              </summary>
              <p className="px-4 pb-4 text-pretty text-sm leading-relaxed text-podium-gray">
                {item.body}
              </p>
            </details>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
