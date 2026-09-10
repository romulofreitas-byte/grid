"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SectionTitle } from "@/components/SectionTitle";
import { WorkOpeningSkeleton } from "@/components/WorkOpeningSkeleton";
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
import {
  EMPTY_CRM_RATE_SUGGESTIONS,
  type CrmRateSample,
  type CrmRateSuggestions,
} from "@/lib/calculadora/crm-rates";
import {
  eachTen,
  formatBrl,
  formatBrlForEdit,
  maskBrlTyping,
  reaisFromBrlMask,
} from "@/lib/calculadora/money";
import { CALCULADORA_GLOSSARIO, COPY } from "@/lib/copy";
import { dropPainelMetricsCache, invalidateLiveStats } from "@/lib/live-stats";
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
    taxaContato: meta.taxaContato || DEFAULT_TAXAS.taxaContato,
    taxa1: meta.taxa1,
    taxa2: meta.taxa2,
    taxa3: meta.taxa3,
    taxa4: meta.taxa4,
    taxasOrigem: meta.taxasOrigem,
  };
}

function sameMetaInput(a: MetaInput, b: MetaInput): boolean {
  return (
    a.nome === b.nome &&
    a.tipo_empresa === b.tipo_empresa &&
    a.metaFaturamento === b.metaFaturamento &&
    a.ticket === b.ticket &&
    a.prazoMeses === b.prazoMeses &&
    a.taxaContato === b.taxaContato &&
    a.taxa1 === b.taxa1 &&
    a.taxa2 === b.taxa2 &&
    a.taxa3 === b.taxa3 &&
    a.taxa4 === b.taxa4 &&
    a.taxasOrigem === b.taxasOrigem
  );
}

function CrmChip({ sample, title }: { sample: CrmRateSample | null; title: string }) {
  if (!sample) return null;
  return (
    <span
      title={title}
      className="shrink-0 cursor-help rounded-md border border-podium-yellow/30 bg-podium-yellow/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-podium-yellow"
    >
      CRM · {sample.numerador}/{sample.denominador}
    </span>
  );
}

type RateKey = "taxaContato" | "taxa1" | "taxa2" | "taxa3" | "taxa4";
type FunnelFocus = RateKey | "discagens";

const RATE_STEP_ID: Record<RateKey, string> = {
  taxa4: "funil-negociacoes",
  taxa3: "funil-r2",
  taxa2: "funil-r1",
  taxa1: "funil-agendadas",
  taxaContato: "funil-decisor",
};

const RATE_EDITOR_ID: Record<RateKey, string> = {
  taxaContato: "taxa-contato",
  taxa1: "taxa-agendada",
  taxa2: "taxa-r1",
  taxa3: "taxa-r2",
  taxa4: "taxa-negociacao",
};

const RATE_BUMP = 5;

function PlanoFact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[5.5rem] min-w-0 flex-col rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-podium-muted">
        {label}
      </p>
      <div className="mt-1 space-y-0.5 text-sm font-semibold tabular-nums leading-snug text-podium-white">
        {children}
      </div>
    </div>
  );
}

function VolumeBar({
  label,
  value,
  max,
  active,
  onSelect,
  hint,
}: {
  label: string;
  value: number;
  max: number;
  active: boolean;
  onSelect: () => void;
  hint?: string;
}) {
  const width = max > 0 ? Math.max(6, Math.round((value / max) * 100)) : 0;
  return (
    <button
      type="button"
      aria-pressed={active}
      title={hint}
      onClick={onSelect}
      className={cn(
        "w-full rounded-md px-1 py-1 text-left transition",
        active ? "bg-podium-yellow/10" : "hover:bg-white/[0.04]",
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-podium-muted">
          {label}
        </span>
        <span className="text-sm font-semibold tabular-nums text-podium-white">
          {formatInt(value)}
        </span>
      </span>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10">
        <span
          className="block h-full rounded-full bg-podium-yellow"
          style={{ width: `${width}%` }}
        />
      </span>
    </button>
  );
}

function FunnelStep({
  label,
  value,
  rate,
  featured = false,
  active = false,
  stepId,
  onSelect,
}: {
  label: string;
  value: number;
  rate?: string;
  featured?: boolean;
  active?: boolean;
  stepId?: string;
  onSelect?: () => void;
}) {
  const className = cn(
    "flex h-full min-h-[6.75rem] flex-col rounded-md border px-3 py-2 text-left",
    featured
      ? "border-podium-yellow/40 bg-podium-yellow/10"
      : "border-white/[0.08] bg-white/[0.03]",
    active && "ring-1 ring-podium-yellow/70",
    onSelect && "transition hover:border-white/25",
  );
  const body = (
    <>
      <p className="min-h-8 text-[10px] font-medium uppercase leading-tight tracking-wide text-podium-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          featured ? "text-podium-yellow" : "text-podium-white",
        )}
      >
        {formatInt(value)}
      </p>
      <p
        className={cn(
          "mt-auto min-h-8 pt-1 text-[10px] font-medium leading-snug",
          rate ? "text-podium-yellow" : "invisible",
        )}
      >
        {rate ?? "—"}
      </p>
    </>
  );
  if (onSelect) {
    return (
      <button
        type="button"
        id={stepId}
        className={className}
        aria-pressed={active}
        onClick={onSelect}
      >
        {body}
      </button>
    );
  }
  return (
    <div id={stepId} className={className}>
      {body}
    </div>
  );
}

function RateRow({
  id,
  label,
  hint,
  value,
  fallback,
  sample,
  active,
  delta,
  onChange,
  onFocus,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  fallback: number;
  sample: CrmRateSample | null;
  active: boolean;
  delta: string | null;
  onChange: (percent: number) => void;
  onFocus: () => void;
}) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-md border px-3 py-3",
        active
          ? "border-podium-yellow/50 bg-podium-yellow/5"
          : "border-white/[0.08] bg-white/[0.03]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-medium leading-snug text-podium-white">
          {label}
        </p>
        <CrmChip
          sample={sample}
          title={
            sample
              ? COPY.calculadoraCrmTaxaTip
                  .replace("{n}", String(sample.numerador))
                  .replace("{d}", String(sample.denominador))
              : ""
          }
        />
      </div>
      <p className="mt-1 text-sm leading-relaxed text-podium-gray">{hint}</p>
      <div className="mt-2 w-24">
        <PercentInput
          id={`${id}-input`}
          ariaLabel={label}
          value={value}
          fallback={fallback}
          onChange={onChange}
          onFocus={onFocus}
        />
      </div>
      {active && delta ? (
        <p className="mt-2 text-sm font-medium text-podium-yellow">{delta}</p>
      ) : null}
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
  onApply,
  applying = false,
}: {
  title: string;
  subtitle?: string;
  detail?: string;
  selected: boolean;
  onBox?: boolean;
  draft?: boolean;
  onSelect?: () => void;
  onApply?: () => void;
  applying?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-1 rounded-md border px-1.5 py-1",
        selected
          ? "border-podium-yellow/40 bg-podium-yellow/10"
          : draft
            ? "border-dashed border-white/20 bg-white/[0.02]"
            : "border-white/10 bg-white/[0.03]",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={!onSelect}
        className={cn(
          "min-w-0 flex-1 rounded-md px-1 py-0.5 text-left transition disabled:cursor-default",
          !selected && !draft && "hover:bg-white/[0.04]",
        )}
      >
        <span className="block truncate text-[12px] font-medium text-podium-white">
          {title}
        </span>
        <span className="block truncate text-[11px] text-podium-muted">
          {[subtitle, detail].filter(Boolean).join(" · ")}
        </span>
      </button>
      {onBox ? (
        <span className="shrink-0 rounded-md border border-podium-yellow/40 bg-podium-yellow/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          {COPY.metasNoBox}
        </span>
      ) : null}
      {onApply ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={applying}
          onClick={onApply}
          className="shrink-0 px-1.5"
        >
          {COPY.metasUsarNoBox}
        </Button>
      ) : null}
    </div>
  );
}

const META_SWAP_TRANSITION = {
  type: "spring" as const,
  stiffness: 380,
  damping: 32,
  mass: 0.75,
};

function MetaListItem({
  front,
  reduce,
  children,
}: {
  front: boolean;
  reduce: boolean | null;
  children: ReactNode;
}) {
  return (
    <motion.div
      layout={reduce ? false : "position"}
      transition={reduce ? { duration: 0 } : META_SWAP_TRANSITION}
      className={cn("relative", front && "z-10")}
    >
      {children}
    </motion.div>
  );
}

function PercentInput({
  id,
  value,
  fallback,
  onChange,
  ariaLabel,
  onFocus,
}: {
  id?: string;
  value: number;
  fallback: number;
  onChange: (percent: number) => void;
  ariaLabel?: string;
  onFocus?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const display = focused ? draft : String(value);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={display}
        onFocus={(e) => {
          setFocused(true);
          setDraft(String(value));
          e.target.select();
          onFocus?.();
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

function initialSelected(payload?: MetasPayload): PilotMeta | null {
  if (!payload) return null;
  return (
    payload.metas.find((row) => row.id === payload.activeMetaId) ??
    payload.metas[0] ??
    null
  );
}

export function MetasPage({ initial }: { initial?: MetasPayload }) {
  const qc = useQueryClient();
  const seeded = initial ?? undefined;
  const seededAtRef = useRef(Date.now());
  const query = useQuery({
    queryKey: METAS_QUERY,
    queryFn: async () => {
      const res = await fetch("/api/metas");
      if (!res.ok) throw new Error("load");
      return (await res.json()) as MetasPayload;
    },
    initialData: seeded,
    initialDataUpdatedAt: seeded ? seededAtRef.current : undefined,
  });
  const suggestionsQuery = useQuery({
    queryKey: ["metas-suggestions"],
    queryFn: async () => {
      const res = await fetch("/api/metas/suggestions");
      if (!res.ok) throw new Error("suggestions");
      const json = (await res.json()) as {
        suggestions?: CrmRateSuggestions;
      };
      return json.suggestions ?? EMPTY_CRM_RATE_SUGGESTIONS;
    },
  });
  const first = initialSelected(seeded);
  const [draft, setDraft] = useState<MetaInput>(
    first ? metaToInput(first) : defaultMetaInput(),
  );
  const draftRef = useRef(draft);
  const [selectedId, setSelectedId] = useState<string | null>(first?.id ?? null);
  const selectedIdRef = useRef(selectedId);
  const [hydrated, setHydrated] = useState(Boolean(seeded));
  const [justApplied, setJustApplied] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PilotMeta | null>(null);
  const [funnelFocus, setFunnelFocus] = useState<FunnelFocus | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!query.data || hydrated) return;
    const { metas, activeMetaId } = query.data;
    const nextMeta =
      metas.find((row) => row.id === activeMetaId) ?? metas[0] ?? null;
    if (nextMeta) {
      const next = metaToInput(nextMeta);
      draftRef.current = next;
      setDraft(next);
      setSelectedId(nextMeta.id);
    }
    setHydrated(true);
  }, [query.data, hydrated]);

  const suggestions =
    suggestionsQuery.data ??
    query.data?.suggestions ??
    EMPTY_CRM_RATE_SUGGESTIONS;
  const activeMetaId = query.data?.activeMetaId ?? null;
  const metas = useMemo(
    () => sortMetasForList(query.data?.metas ?? [], activeMetaId),
    [query.data?.metas, activeMetaId],
  );
  const result = useMemo(
    () => calculateFunnel(funnelFromMeta(draft)),
    [draft],
  );
  const rateFocus =
    funnelFocus && funnelFocus !== "discagens" ? funnelFocus : null;
  const deltaDaily = useMemo(() => {
    if (!rateFocus) return null;
    const current = draft[rateFocus] || DEFAULT_TAXAS[rateFocus];
    const bumped = Math.min(100, current + RATE_BUMP);
    if (bumped === current) return null;
    const nextDaily = calculateFunnel(
      funnelFromMeta({ ...draft, [rateFocus]: bumped }),
    ).ligacoesPorDia;
    if (nextDaily === result.ligacoesPorDia) return null;
    return { pp: bumped - current, daily: nextDaily };
  }, [rateFocus, draft, result.ligacoesPorDia]);
  const activeOnBox = Boolean(selectedId && selectedId === activeMetaId);

  function setCache(data: MetasPayload) {
    qc.setQueryData(METAS_QUERY, {
      ...data,
      suggestions:
        suggestionsQuery.data ??
        data.suggestions ??
        EMPTY_CRM_RATE_SUGGESTIONS,
    });
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function promoteInList(id: string) {
    await qc.cancelQueries({ queryKey: METAS_QUERY });
    const previous = qc.getQueryData<MetasPayload>(METAS_QUERY);
    if (!previous || previous.activeMetaId === id) return previous ?? null;
    qc.setQueryData(METAS_QUERY, {
      ...previous,
      activeMetaId: id,
      suggestions:
        suggestionsQuery.data ??
        previous.suggestions ??
        EMPTY_CRM_RATE_SUGGESTIONS,
    });
    return previous;
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
    onMutate: async (opts) => {
      if (!opts.apply) return;
      const id = selectedIdRef.current;
      if (!id) return;
      const previous = await promoteInList(id);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) setCache(ctx.previous);
    },
    onSuccess: (data, vars) => {
      if (!data) return;
      setCache(data);
      if (vars.apply) {
        dropPainelMetricsCache(qc);
        void invalidateLiveStats(qc);
      }
      const currentId = selectedIdRef.current;
      const selected = data.metas.find((row) => row.id === currentId);
      if (selected) {
        const next = metaToInput(selected);
        draftRef.current = next;
        setDraft(next);
      }
      setJustApplied(Boolean(vars.apply));
      setJustSaved(!vars.apply);
    },
  });

  const applyRemote = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/metas/${id}/apply`, { method: "POST" });
      return readPayload(res);
    },
    onMutate: async (id) => {
      const previous = await promoteInList(id);
      const prevSelectedId = selectedIdRef.current;
      const prevDraft = draftRef.current;
      const selected = (previous ?? qc.getQueryData<MetasPayload>(METAS_QUERY))
        ?.metas.find((row) => row.id === id);
      if (selected) {
        const next = metaToInput(selected);
        draftRef.current = next;
        setDraft(next);
        selectedIdRef.current = selected.id;
        setSelectedId(selected.id);
      }
      return { previous, prevSelectedId, prevDraft };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) setCache(ctx.previous);
      if (ctx?.prevDraft) {
        draftRef.current = ctx.prevDraft;
        setDraft(ctx.prevDraft);
      }
      if (ctx?.prevSelectedId !== undefined) {
        selectedIdRef.current = ctx.prevSelectedId;
        setSelectedId(ctx.prevSelectedId);
      }
    },
    onSuccess: (data, id) => {
      setCache(data);
      dropPainelMetricsCache(qc);
      void invalidateLiveStats(qc);
      const selected = data.metas.find((row) => row.id === id);
      if (selected) {
        const next = metaToInput(selected);
        draftRef.current = next;
        setDraft(next);
        selectedIdRef.current = selected.id;
        setSelectedId(selected.id);
      }
      setJustApplied(true);
      setJustSaved(false);
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
    setFunnelFocus(null);
    const next = metaToInput(meta);
    draftRef.current = next;
    setDraft(next);
    selectedIdRef.current = meta.id;
    setSelectedId(meta.id);
  }

  function startNew() {
    setJustApplied(false);
    setJustSaved(false);
    setFunnelFocus(null);
    const next = defaultMetaInput();
    draftRef.current = next;
    setDraft(next);
    selectedIdRef.current = null;
    setSelectedId(null);
  }

  function selectFunnel(next: FunnelFocus, opts?: { toggle?: boolean }) {
    const turningOff = Boolean(opts?.toggle) && funnelFocus === next;
    setFunnelFocus(turningOff ? null : next);
    if (turningOff || next === "discagens") return;
    requestAnimationFrame(() => {
      document.getElementById(RATE_EDITOR_ID[next])?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  function applyCrmRates(next: CrmRateSuggestions) {
    setJustApplied(false);
    setJustSaved(false);
    const updated = {
      ...draftRef.current,
      taxaContato: next.taxaContato?.percent ?? draftRef.current.taxaContato,
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
      taxaContato: DEFAULT_TAXAS.taxaContato,
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
    suggestions?.taxaContato ||
      suggestions?.taxa1 ||
      suggestions?.taxa2 ||
      suggestions?.taxa3 ||
      suggestions?.taxa4,
  );

  function applyCard(meta: PilotMeta) {
    if (
      meta.id === selectedIdRef.current &&
      !sameMetaInput(draftRef.current, metaToInput(meta))
    ) {
      save.mutate({ apply: true });
      return;
    }
    applyRemote.mutate(meta.id);
  }

  if (query.isError) {
    return <p className="text-sm text-podium-gray">{COPY.metasLoadError}</p>;
  }

  if (query.isLoading || !hydrated) {
    return <WorkOpeningSkeleton label={COPY.metasOpening} split />;
  }

  const persistError = save.error ?? applyRemote.error ?? remove.error;
  const selectedMeta = metas.find((row) => row.id === selectedId) ?? null;
  const dirty =
    selectedId === null
      ? !sameMetaInput(draft, defaultMetaInput())
      : !selectedMeta || !sameMetaInput(draft, metaToInput(selectedMeta));
  const canSave = Boolean(draft.nome.trim()) && dirty && !save.isPending;
  const canSaveAndApply =
    Boolean(draft.nome.trim()) &&
    result.ready &&
    !save.isPending &&
    (dirty || !activeOnBox);
  const applying = save.isPending || applyRemote.isPending;

  return (
    <div className={workSplitClass}>
      <motion.div className={workSplitRailClass} layoutScroll>
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
        <div id="suas-metas" className="mt-2 flex min-h-0 flex-1 flex-col gap-1">
          {metas.length === 0 && selectedId !== null ? (
            <p className="px-1 py-6 text-sm text-podium-muted">{COPY.metasEmpty}</p>
          ) : (
            <LayoutGroup id="suas-metas">
              {metas.map((meta) => {
                const daily = calculateFunnel(funnelFromMeta(meta)).ligacoesPorDia;
                const selected = meta.id === selectedId;
                const onBox = meta.id === activeMetaId;
                return (
                  <MetaListItem
                    key={meta.id}
                    front={onBox}
                    reduce={reduceMotion}
                  >
                    <MetaPickCard
                      title={meta.nome}
                      subtitle={meta.tipo_empresa || undefined}
                      detail={`${formatBrl(meta.ticket)} · ${formatInt(daily)} lig/dia`}
                      selected={selected}
                      onBox={onBox}
                      onSelect={() => selectMeta(meta)}
                      onApply={onBox ? undefined : () => applyCard(meta)}
                      applying={
                        applying &&
                        ((save.isPending && selected && dirty) ||
                          applyRemote.variables === meta.id)
                      }
                    />
                  </MetaListItem>
                );
              })}
              {selectedId === null ? (
                <MetaListItem front={false} reduce={reduceMotion}>
                  <MetaPickCard
                    title={draft.nome.trim() || COPY.metasNova}
                    subtitle={draft.tipo_empresa.trim() || undefined}
                    detail={COPY.metasRascunho}
                    selected
                    draft
                  />
                </MetaListItem>
              ) : null}
            </LayoutGroup>
          )}
        </div>
      </motion.div>

      <div id="meta-funil" className={workSplitPaneClass}>
        <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 border-b border-white/10 bg-podium-navy/95 py-2 backdrop-blur-xl">
          <div className="min-w-[5.5rem] px-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-podium-muted">
              {COPY.calculadoraPorDia}
            </p>
            <p className="text-xl font-semibold tabular-nums text-podium-yellow">
              {formatInt(result.ligacoesPorDia)}
            </p>
          </div>
          {dirty ? (
            <span className="rounded-md border border-podium-yellow/40 bg-podium-yellow/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
              {COPY.metasNaoSalvo}
            </span>
          ) : null}
          {justSaved ? (
            <span className="text-sm font-bold text-podium-yellow">
              {COPY.metasSalva}
            </span>
          ) : null}
          {justApplied ? (
            <span className="text-sm font-bold text-podium-yellow">
              {COPY.calculadoraApplied}
            </span>
          ) : null}
          {persistError ? (
            <span className="text-sm text-red-400">
              {persistError instanceof Error
                ? persistError.message
                : "Não foi possível salvar."}
            </span>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={!canSave}
              title={COPY.metasSalvarHint}
              onClick={() => save.mutate({ list: true })}
            >
              {COPY.metasSalvar}
            </Button>
            <Button
              type="button"
              variant="accent"
              size="md"
              disabled={!canSaveAndApply}
              onClick={() => save.mutate({ apply: true })}
            >
              {COPY.metasSalvarEUsar}
            </Button>
            {justApplied || activeOnBox ? (
              <Link
                href="/box"
                className={buttonClassName({ variant: "secondary", size: "md" })}
              >
                {COPY.calculadoraOpenBox}
              </Link>
            ) : null}
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
        </div>

        <div className="space-y-3 pb-3">
          <GlassCard className="p-3" hover={false}>
            <label className="block">
              <span className="sr-only">{COPY.metasNome}</span>
              <input
                type="text"
                maxLength={80}
                value={draft.nome}
                onChange={(e) => patch({ nome: e.target.value })}
                placeholder={COPY.metasNome}
                className="w-full rounded-md border border-transparent bg-transparent px-1 text-base font-semibold text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40"
              />
            </label>
            <label className="mt-0.5 block">
              <span className="sr-only">{COPY.metasTipoEmpresa}</span>
              <input
                type="text"
                maxLength={80}
                value={draft.tipo_empresa}
                onChange={(e) => patch({ tipo_empresa: e.target.value })}
                placeholder={COPY.metasTipoEmpresa}
                className="w-full rounded-md border border-transparent bg-transparent px-1 text-sm text-podium-muted outline-none placeholder:text-podium-muted/70 focus:border-podium-yellow/40"
              />
            </label>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
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
                      className="cursor-help rounded-md border border-podium-yellow/30 bg-podium-yellow/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-podium-yellow"
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
                {result.ready && result.dataFinal ? (
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-podium-muted">
                    {result.dataFinal.toLocaleDateString("pt-BR")}
                  </p>
                ) : null}
              </label>
            </div>
          </GlassCard>

          <GlassCard className="p-3" hover={false}>
            <SectionTitle>{COPY.calculadoraFunil}</SectionTitle>
            <div className="mt-4 grid grid-cols-2 items-stretch gap-2 xl:grid-cols-6">
              <FunnelStep
                label={COPY.calculadoraPassoContratos}
                value={result.contratos}
                featured
              />
              <FunnelStep
                label={COPY.calculadoraPassoNegociacoes}
                value={result.negociacoes}
                stepId={RATE_STEP_ID.taxa4}
                active={funnelFocus === "taxa4"}
                onSelect={() => selectFunnel("taxa4", { toggle: true })}
                rate={`${draft.taxa4 || DEFAULT_TAXAS.taxa4}% → ${COPY.calculadoraPassoContratosShort}`}
              />
              <FunnelStep
                label={COPY.calculadoraPassoR2}
                value={result.r2}
                stepId={RATE_STEP_ID.taxa3}
                active={funnelFocus === "taxa3"}
                onSelect={() => selectFunnel("taxa3", { toggle: true })}
                rate={`${draft.taxa3 || DEFAULT_TAXAS.taxa3}% → ${COPY.calculadoraPassoNegociacoesShort}`}
              />
              <FunnelStep
                label={COPY.calculadoraPassoR1}
                value={result.r1}
                stepId={RATE_STEP_ID.taxa2}
                active={funnelFocus === "taxa2"}
                onSelect={() => selectFunnel("taxa2", { toggle: true })}
                rate={`${draft.taxa2 || DEFAULT_TAXAS.taxa2}% → ${COPY.calculadoraPassoR2Short}`}
              />
              <FunnelStep
                label={COPY.calculadoraPassoAgendada}
                value={result.reunioesAgendadas}
                stepId={RATE_STEP_ID.taxa1}
                active={funnelFocus === "taxa1"}
                onSelect={() => selectFunnel("taxa1", { toggle: true })}
                rate={`${draft.taxa1 || DEFAULT_TAXAS.taxa1}% → ${COPY.calculadoraPassoR1Short}`}
              />
              <FunnelStep
                label={COPY.calculadoraPassoDecisor}
                value={result.ligacoesDecisor}
                stepId={RATE_STEP_ID.taxaContato}
                active={funnelFocus === "taxaContato"}
                onSelect={() => selectFunnel("taxaContato", { toggle: true })}
                rate={`${draft.taxaContato || DEFAULT_TAXAS.taxaContato}% → ${COPY.calculadoraPassoAgendadaShort}`}
              />
            </div>
            {funnelFocus === "discagens" ? (
              <p className="mt-3 text-sm text-podium-gray">
                {COPY.calculadoraPlanoX3}
              </p>
            ) : null}
          </GlassCard>

          <GlassCard className="p-3" hover={false}>
            <div className="flex flex-col gap-2">
              <SectionTitle>{COPY.calculadoraTaxas}</SectionTitle>
              <Hint>{COPY.calculadoraTaxasLead}</Hint>
              {hasCrmRates ? (
                <button
                  type="button"
                  title={
                    draft.taxasOrigem === "crm"
                      ? COPY.calculadoraUsarPadraoTip
                      : COPY.calculadoraUsarCrmTip
                  }
                  className={cn(
                    buttonClassName({ variant: "accent", size: "sm" }),
                    "w-fit shrink-0",
                  )}
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
            </div>
            <div className="mt-3 space-y-2">
              {(
                [
                  [
                    "taxaContato",
                    COPY.calculadoraTaxaContato,
                    COPY.calculadoraTaxaContatoHint,
                    suggestions?.taxaContato,
                    DEFAULT_TAXAS.taxaContato,
                  ],
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
                <RateRow
                  key={key}
                  id={RATE_EDITOR_ID[key]}
                  label={label}
                  hint={hint.replace(
                    "{n}",
                    eachTen(draft[key] || fallback),
                  )}
                  value={draft[key]}
                  fallback={fallback}
                  sample={sample ?? null}
                  active={funnelFocus === key}
                  delta={
                    rateFocus === key && deltaDaily
                      ? COPY.calculadoraDeltaDia
                          .replace("{pp}", String(deltaDaily.pp))
                          .replace("{n}", formatInt(deltaDaily.daily))
                      : null
                  }
                  onChange={(percent) => patch({ [key]: percent }, "manual")}
                  onFocus={() => selectFunnel(key)}
                />
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-3" highlight hover={false}>
            <SectionTitle>{COPY.calculadoraPlano}</SectionTitle>
            <div className="mt-3 grid items-stretch gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
              <div className="flex min-h-[5.5rem] min-w-0 flex-col rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-2">
                <p className="px-1 text-[10px] font-medium uppercase tracking-wide text-podium-muted">
                  {COPY.calculadoraPlanoPeriodo}
                </p>
                <div className="mt-1 space-y-0.5">
                  <VolumeBar
                    label={COPY.calculadoraPlanoBarDiscagens}
                    value={result.ligacoesTotais}
                    max={result.ligacoesTotais}
                    active={funnelFocus === "discagens"}
                    hint={COPY.calculadoraPlanoX3}
                    onSelect={() => selectFunnel("discagens", { toggle: true })}
                  />
                  <VolumeBar
                    label={COPY.calculadoraPlanoBarDecisor}
                    value={result.ligacoesDecisor}
                    max={result.ligacoesTotais}
                    active={funnelFocus === "taxaContato"}
                    onSelect={() =>
                      selectFunnel("taxaContato", { toggle: true })
                    }
                  />
                  <VolumeBar
                    label={COPY.calculadoraPlanoBarAgendadas}
                    value={result.reunioesAgendadas}
                    max={result.ligacoesTotais}
                    active={funnelFocus === "taxa1"}
                    onSelect={() => selectFunnel("taxa1", { toggle: true })}
                  />
                </div>
              </div>
              <PlanoFact label={COPY.calculadoraPlanoPrazo}>
                {result.ready && result.dataFinal ? (
                  <>
                    <p>{result.dataFinal.toLocaleDateString("pt-BR")}</p>
                    <div className="mt-2 flex min-w-0 flex-wrap gap-1">
                      {Array.from(
                        { length: Math.max(1, Math.min(result.semanas, 12)) },
                        (_, index) => (
                          <span
                            key={index}
                            className="h-1.5 w-3 shrink-0 rounded-full bg-podium-yellow/70"
                          />
                        ),
                      )}
                    </div>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-podium-muted">
                      {COPY.calculadoraPlanoPrazoValue
                        .replace("{semanas}", formatInt(result.semanas))
                        .replace("{dias}", formatInt(result.diasProspeccao))}
                    </p>
                  </>
                ) : (
                  <p className="font-medium text-podium-muted">
                    {COPY.calculadoraCtaNeed}
                  </p>
                )}
              </PlanoFact>
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
