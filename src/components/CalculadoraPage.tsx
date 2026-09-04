"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SectionTitle } from "@/components/SectionTitle";
import type { CalculadoraPayload } from "@/lib/calculadora/payload";
import {
  calculateFunnel,
  DEFAULT_TAXAS,
  defaultFunnelPlan,
  type FunnelPlan,
} from "@/lib/calculadora/funnel";
import type { CrmRateSample, CrmRateSuggestions } from "@/lib/calculadora/crm-rates";
import {
  eachTen,
  formatBrl,
  maskBrlTyping,
  reaisFromBrlMask,
} from "@/lib/calculadora/money";
import { CALCULADORA_GLOSSARIO, COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 outline-none focus:border-podium-yellow/40";

const CALCULADORA_QUERY = ["calculadora"] as const;

function formatInt(n: number): string {
  return n.toLocaleString("pt-BR");
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
  const display = focused ? draft : formatBrl(value);

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="R$ 0,00"
      value={display}
      onFocus={(e) => {
        setFocused(true);
        setDraft(value > 0 ? formatBrl(value) : "");
        e.target.select();
      }}
      onChange={(e) => {
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

export function CalculadoraPage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: CALCULADORA_QUERY,
    queryFn: async () => {
      const res = await fetch("/api/calculadora");
      if (!res.ok) throw new Error("load");
      return (await res.json()) as CalculadoraPayload;
    },
  });
  const [plan, setPlan] = useState<FunnelPlan>(defaultFunnelPlan);
  const planRef = useRef(plan);
  const [hydrated, setHydrated] = useState(false);
  const [justApplied, setJustApplied] = useState(false);

  useEffect(() => {
    if (!query.data || hydrated) return;
    setPlan(query.data.plan);
    planRef.current = query.data.plan;
    setHydrated(true);
  }, [query.data, hydrated]);

  const suggestions = query.data?.suggestions;
  const result = useMemo(() => calculateFunnel(plan), [plan]);

  const save = useMutation({
    mutationFn: async (input: { plan: FunnelPlan; apply?: boolean }) => {
      const res = await fetch("/api/calculadora", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = (await res.json()) as CalculadoraPayload & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "save");
      return json;
    },
    onSuccess: (data, vars) => {
      qc.setQueryData(CALCULADORA_QUERY, data);
      setPlan(data.plan);
      planRef.current = data.plan;
      qc.invalidateQueries({ queryKey: ["profile"] });
      setJustApplied(Boolean(vars.apply));
    },
  });

  function patch(partial: Partial<FunnelPlan>, origem?: FunnelPlan["taxasOrigem"]) {
    setJustApplied(false);
    const next = {
      ...planRef.current,
      ...partial,
      taxasOrigem: origem ?? planRef.current.taxasOrigem,
    };
    planRef.current = next;
    setPlan(next);
  }

  function applyCrmRates(next: CrmRateSuggestions) {
    setJustApplied(false);
    const updated = {
      ...planRef.current,
      taxa1: next.taxa1?.percent ?? planRef.current.taxa1,
      taxa2: next.taxa2?.percent ?? planRef.current.taxa2,
      taxa3: next.taxa3?.percent ?? planRef.current.taxa3,
      taxa4: next.taxa4?.percent ?? planRef.current.taxa4,
      taxasOrigem: "crm" as const,
    };
    planRef.current = updated;
    setPlan(updated);
  }

  const hasCrmRates = Boolean(
    suggestions?.taxa1 ||
      suggestions?.taxa2 ||
      suggestions?.taxa3 ||
      suggestions?.taxa4,
  );

  if (query.isError) {
    return (
      <p className="text-sm text-podium-gray">
        Não foi possível carregar a calculadora. Recarregue a página.
      </p>
    );
  }

  if (query.isLoading || !hydrated) {
    return <p className="text-sm text-podium-muted">Carregando…</p>;
  }

  const ctaLabel = COPY.calculadoraCta.replace("{n}", formatInt(result.ligacoesPorDia));

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
        <SectionTitle>{COPY.calculadoraObjetivo}</SectionTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="block text-sm text-podium-gray">
            {COPY.calculadoraMetaFaturamento}
            <MoneyInput
              value={plan.metaFaturamento}
              onChange={(metaFaturamento) => patch({ metaFaturamento })}
              onBlur={() => save.mutate({ plan: planRef.current })}
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
              value={plan.ticket}
              onChange={(ticket) => patch({ ticket })}
              onBlur={() => save.mutate({ plan: planRef.current })}
            />
            {suggestions?.ticket ? (
              <button
                type="button"
                className="mt-1.5 text-xs font-bold text-podium-yellow"
                onClick={() => {
                  const next = {
                    ...planRef.current,
                    ticket: suggestions.ticket!.reais,
                  };
                  planRef.current = next;
                  setPlan(next);
                  save.mutate({ plan: next });
                }}
              >
                {COPY.calculadoraUsarTicketCrm} ({formatBrl(suggestions.ticket.reais)})
              </button>
            ) : null}
          </label>
          <label className="block text-sm text-podium-gray">
            {COPY.calculadoraPrazo}
            <input
              type="number"
              min={1}
              step={1}
              value={plan.prazoMeses || ""}
              onChange={(e) => patch({ prazoMeses: Number(e.target.value) || 0 })}
              onBlur={() => save.mutate({ plan: planRef.current })}
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
                save.mutate({ plan: planRef.current });
              }}
            >
              {COPY.calculadoraUsarCrm}
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(
            [
              ["taxa1", COPY.calculadoraTaxa1, COPY.calculadoraTaxa1Hint, suggestions?.taxa1, DEFAULT_TAXAS.taxa1],
              ["taxa2", COPY.calculadoraTaxa2, COPY.calculadoraTaxa2Hint, suggestions?.taxa2, DEFAULT_TAXAS.taxa2],
              ["taxa3", COPY.calculadoraTaxa3, COPY.calculadoraTaxa3Hint, suggestions?.taxa3, DEFAULT_TAXAS.taxa3],
              ["taxa4", COPY.calculadoraTaxa4, COPY.calculadoraTaxa4Hint, suggestions?.taxa4, DEFAULT_TAXAS.taxa4],
            ] as const
          ).map(([key, label, hint, sample, fallback]) => (
            <label key={key} className="block text-sm text-podium-gray">
              <span className="flex items-center justify-between gap-2">
                {label}
                <CrmChip sample={sample ?? null} />
              </span>
              <PercentInput
                value={plan[key]}
                fallback={fallback}
                onChange={(percent) => patch({ [key]: percent }, "manual")}
                onBlur={() => save.mutate({ plan: planRef.current })}
              />
              <Hint className="mt-1">
                {hint.replace("{n}", eachTen(plan[key] || fallback))}
              </Hint>
            </label>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-5 md:p-6" hover={false}>
        <SectionTitle>{COPY.calculadoraFunil}</SectionTitle>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
          <FunnelStep label={COPY.calculadoraPassoContratos} value={result.contratos} />
          <FunnelStep label={COPY.calculadoraPassoNegociacoes} value={result.negociacoes} />
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
          <FunnelStep label={COPY.calculadoraTotais} value={result.ligacoesTotais} />
          <FunnelStep label={COPY.calculadoraDecisor} value={result.ligacoesDecisor} />
          <FunnelStep
            label={COPY.calculadoraPorDia}
            value={result.ligacoesPorDia}
            featured
          />
        </div>
        <Hint className="mt-4">{COPY.calculadoraPremissas}</Hint>
        {result.ready && result.dataFinal ? (
          <p className="mt-2 text-sm text-podium-gray">
            {formatBrl(plan.metaFaturamento)} em {plan.prazoMeses}{" "}
            {plan.prazoMeses === 1 ? "mês" : "meses"}, até{" "}
            {result.dataFinal.toLocaleDateString("pt-BR")}. {result.semanas} semanas ·{" "}
            {result.diasProspeccao} dias de prospecção.
          </p>
        ) : (
          <p className="mt-2 text-sm text-podium-muted">{COPY.calculadoraCtaNeed}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!result.ready || save.isPending}
            onClick={() => save.mutate({ plan: planRef.current, apply: true })}
            className="rounded-xl bg-podium-yellow px-6 py-3 text-sm font-extrabold text-podium-navy transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {result.ready ? ctaLabel : COPY.calculadoraCtaNeed}
          </button>
          {justApplied || plan.appliedAt ? (
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
        {save.isError ? (
          <p className="mt-3 text-sm text-red-400">
            {save.error instanceof Error
              ? save.error.message
              : "Não foi possível salvar."}
          </p>
        ) : null}
      </GlassCard>

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
