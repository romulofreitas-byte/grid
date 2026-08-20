"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BackLink } from "@/components/BackLink";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SectionTitle } from "@/components/SectionTitle";
import { COPY, PORTE_LABELS } from "@/lib/copy";
import { BACK, gridHref, parseGridFrom } from "@/lib/back";
import { filterStepFilled } from "@/lib/filter-summary";
import { formatCnae, formatCnpj } from "@/lib/format";
import {
  clearDraft,
  draftHasWork,
  mergeFilters,
  readDraft,
  resolveLargadaSource,
  writeDraft,
} from "@/lib/search-draft";
import {
  filterMunicipios,
  municipioLetters,
} from "@/lib/municipios";
import {
  DEFAULT_FILTERS,
  type CountMode,
  type CountResult,
  type Search as GridSearch,
  type SearchFilters,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type NicheTree = {
  id: string;
  nome: string;
  grupo: string;
  segments: Array<{ id: string; nome: string }>;
};

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

function hasCountScope(filters: SearchFilters): boolean {
  return (
    filters.segmentIds.length > 0 ||
    (!!filters.intentQuery && filters.intentQuery.length >= 2) ||
    filters.cnaes.length > 0 ||
    (filters.cnpjs?.length ?? 0) > 0
  );
}

function shouldFetchCount(
  step: number,
  filters: SearchFilters,
  countReady: boolean,
): boolean {
  if (!countReady) return false;
  const hasCnpjs = (filters.cnpjs?.length ?? 0) > 0;
  if (step === 1) return hasCnpjs;
  return filters.ufs.length > 0;
}

async function fetchCount(
  filters: SearchFilters,
  mode: CountMode,
  signal?: AbortSignal,
) {
  const res = await fetch("/api/search/count", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...filters, mode }),
    signal,
  });
  return res.json();
}

function ToggleRow({
  checked,
  onChange,
  title,
  hint,
  recommended,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint?: string;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition",
        recommended && checked && "recommend-pulse",
        checked
          ? recommended
            ? "border-podium-yellow bg-podium-yellow/15"
            : "border-podium-yellow/40 bg-podium-yellow/10"
          : recommended
            ? "border-podium-yellow/50 bg-white/[0.02] hover:border-podium-yellow/70"
            : "border-white/10 bg-white/[0.02] hover:border-white/20",
      )}
    >
      <span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-podium-white">{title}</span>
          {recommended ? (
            <span className="rounded-full bg-podium-yellow px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-podium-navy">
              Recomendado
            </span>
          ) : null}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-podium-muted">{hint}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition",
          checked ? "bg-podium-yellow" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-6 w-6 rounded-full bg-podium-navy transition",
            checked ? "left-5" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

export default function LargadaPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Nova lista" back={BACK.box}>
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
        </AppShell>
      }
    >
      <LargadaWizard />
    </Suspense>
  );
}

function LargadaWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const novaParam = searchParams.get("nova") === "1";
  const fromSearchParam = searchParams.get("fromSearch");
  const fromParam = parseGridFrom(searchParams.get("from"));

  const [step, setStep] = useState(1);
  const [filters, setFilters] = useState<SearchFilters>({ ...DEFAULT_FILTERS });
  const [openNiche, setOpenNiche] = useState<string | null>(null);
  const [intentDraft, setIntentDraft] = useState("");
  const [munQuery, setMunQuery] = useState("");
  const [munLetter, setMunLetter] = useState<string | null>(null);
  const [citiesOpen, setCitiesOpen] = useState(false);
  const [showCnaePanel, setShowCnaePanel] = useState(false);
  const [cnaeDraft, setCnaeDraft] = useState("");
  const [companyLabels, setCompanyLabels] = useState<Record<string, string>>({});
  const [cnaeLabels, setCnaeLabels] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<"nova" | "continuar" | "ajustar">("nova");
  const [sourceNome, setSourceNome] = useState<string | null>(null);
  const [sourceSearchId, setSourceSearchId] = useState<string | null>(null);
  const [moreFilters, setMoreFilters] = useState(false);
  const autoOpenedNiche = useRef(false);

  useEffect(() => {
    if (hydrated) return;
    let cancelled = false;

    async function hydrate() {
      const source = resolveLargadaSource({
        nova: novaParam,
        fromSearch: fromSearchParam,
        hasDraft: draftHasWork(readDraft()),
      });

      if (source === "nova") {
        clearDraft();
        if (!cancelled) {
          setMode("nova");
          setHydrated(true);
        }
        if (novaParam) router.replace("/largada");
        return;
      }

      if (source === "fromSearch" && fromSearchParam) {
        try {
          const res = await fetch(
            `/api/search/${encodeURIComponent(fromSearchParam)}`,
          );
          if (!res.ok) throw new Error("missing");
          const search = (await res.json()) as GridSearch;
          if (cancelled) return;
          const next = mergeFilters(search.filtros);
          setFilters(next);
          setIntentDraft(next.intentQuery ?? "");
          setStep(1);
          setCompanyLabels({});
          setCnaeLabels({});
          setSourceNome(search.nome);
          setSourceSearchId(search.id);
          setMode("ajustar");
          if (next.cnaes.length > 0) setShowCnaePanel(true);
        } catch {
          if (!cancelled) setMode("nova");
        } finally {
          if (!cancelled) setHydrated(true);
        }
        return;
      }

      const draft = readDraft();
      if (source === "draft" && draft) {
        const next = mergeFilters(draft.filters);
        setFilters(next);
        setStep(draft.step || 1);
        setIntentDraft(draft.intentDraft ?? "");
        setCompanyLabels(draft.companyLabels ?? {});
        setCnaeLabels(draft.cnaeLabels ?? {});
        setSourceSearchId(draft.fromSearch);
        setMode("continuar");
        if (next.cnaes.length > 0) setShowCnaePanel(true);
      }
      if (!cancelled) setHydrated(true);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [hydrated, novaParam, fromSearchParam, router]);

  useEffect(() => {
    if (!hydrated) return;
    writeDraft({
      filters,
      step,
      intentDraft,
      companyLabels,
      cnaeLabels,
      fromSearch: sourceSearchId,
    });
  }, [
    hydrated,
    filters,
    step,
    intentDraft,
    companyLabels,
    cnaeLabels,
    sourceSearchId,
  ]);

  const treeQuery = useQuery({
    queryKey: ["niche-tree"],
    queryFn: async () => {
      const res = await fetch("/api/niches/presets?tree=1");
      if (!res.ok) throw new Error("niches");
      return (await res.json()) as NicheTree[];
    },
  });

  const municipiosQuery = useQuery({
    queryKey: ["municipios", filters.ufs],
    queryFn: async () => {
      const res = await fetch(
        `/api/ref/municipios?ufs=${filters.ufs.join(",")}`,
      );
      return (await res.json()) as Array<{ id: number; nome: string; uf: string }>;
    },
    enabled: filters.ufs.length > 0,
  });

  useEffect(() => {
    setMunQuery("");
    setMunLetter(null);
  }, [filters.ufs]);

  useEffect(() => {
    if (step === 2 && filters.municipioIds.length > 0) {
      setCitiesOpen(true);
    }
  }, [step, filters.municipioIds.length]);

  const cnaePreview = useQuery({
    queryKey: [
      "cnae-preview",
      filters.segmentIds,
      filters.intentQuery,
      filters.cnaes,
      filters.ufs,
    ],
    queryFn: async () => {
      const res = await fetch("/api/niches/cnae-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentIds: filters.segmentIds,
          intentQuery: filters.intentQuery,
          cnaes: filters.cnaes,
          ufs: filters.ufs,
        }),
      });
      return (await res.json()) as Array<{
        codigo: string;
        descricao: string;
        count: number;
        selected: boolean;
      }>;
    },
    enabled:
      showCnaePanel &&
      (filters.segmentIds.length > 0 ||
        (!!filters.intentQuery && filters.intentQuery.length >= 2)),
  });

  const cnaeQ = useDebounced(cnaeDraft, 300);
  const cnaeSearchQuery = useQuery({
    queryKey: ["cnae-search", cnaeQ],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/ref/cnaes?q=${encodeURIComponent(cnaeQ)}`,
        { signal },
      );
      return (await res.json()) as Array<{
        codigo: string;
        descricao: string;
        count: number;
      }>;
    },
    enabled: cnaeQ.trim().length >= 2,
  });

  const debouncedFilters = useDebounced(filters, 500);
  const liveReady = hasCountScope(filters);
  const countReady = hasCountScope(debouncedFilters);
  const countMode: CountMode = step >= 3 ? "full" : "total";
  const countFetchEnabled = shouldFetchCount(step, debouncedFilters, countReady);
  const countQuery = useQuery({
    queryKey: ["count", countMode, debouncedFilters],
    queryFn: ({ signal }) => fetchCount(debouncedFilters, countMode, signal),
    enabled: countFetchEnabled,
    placeholderData: (prev) => prev,
  });
  const showVolumeAside = step >= 2 && filters.ufs.length > 0;
  const showCountPanel = countFetchEnabled;
  const showCountMunicipios = step >= 2 && showCountPanel;
  const showCountBreakdown = step >= 3;

  const nicheTree = useMemo(
    () => (Array.isArray(treeQuery.data) ? treeQuery.data : []),
    [treeQuery.data],
  );
  const b2c = useMemo(
    () => nicheTree.filter((n) => n.grupo === "b2c_local"),
    [nicheTree],
  );
  const b2b = useMemo(
    () => nicheTree.filter((n) => n.grupo === "b2b_industria"),
    [nicheTree],
  );

  const segmentNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nicheTree) {
      for (const s of n.segments) map.set(s.id, s.nome);
    }
    return map;
  }, [nicheTree]);

  const municipiosAll = useMemo(
    () => (Array.isArray(municipiosQuery.data) ? municipiosQuery.data : []),
    [municipiosQuery.data],
  );
  const munLetterOptions = useMemo(
    () => municipioLetters(municipiosAll),
    [municipiosAll],
  );
  const municipiosShown = useMemo(
    () => filterMunicipios(municipiosAll, { letter: munLetter, q: munQuery }),
    [municipiosAll, munLetter, munQuery],
  );

  useEffect(() => {
    if (autoOpenedNiche.current) return;
    if (nicheTree.length === 0 || filters.segmentIds.length === 0) return;
    const first = nicheTree.find((n) =>
      n.segments.some((s) => filters.segmentIds.includes(s.id)),
    );
    if (first) {
      setOpenNiche(first.id);
      autoOpenedNiche.current = true;
    }
  }, [nicheTree, filters.segmentIds]);

  function patch(p: Partial<SearchFilters>) {
    setFilters((f) => ({ ...f, ...p }));
  }

  function toggleSegment(id: string) {
    setFilters((f) => {
      const has = f.segmentIds.includes(id);
      return {
        ...f,
        presetId: null,
        segmentIds: has ? [] : [id],
      };
    });
  }

  function toggleCnae(codigo: string) {
    setFilters((f) => {
      const has = f.cnaes.includes(codigo);
      return {
        ...f,
        cnaes: has ? f.cnaes.filter((c) => c !== codigo) : [...f.cnaes, codigo],
      };
    });
  }

  function addCnaeFromSearch(codigo: string, descricao: string) {
    setCnaeLabels((m) => ({ ...m, [codigo]: descricao }));
    setFilters((f) => {
      if (f.cnaes.includes(codigo)) return f;
      return { ...f, cnaes: [...f.cnaes, codigo] };
    });
    setCnaeDraft("");
    setShowCnaePanel(true);
  }

  const runSearch = useMutation({
    mutationKey: ["search-run"],
    mutationFn: async () => {
      const parts = filters.segmentIds
        .map((id) => segmentNames.get(id))
        .filter(Boolean)
        .slice(0, 2);
      const nome =
        parts.length > 0
          ? `Lista · ${parts.join(" + ")}`
          : filters.intentQuery
            ? `Lista · ${filters.intentQuery}`
            : filters.cnpjs.length
              ? `Lista · empresas`
              : filters.cnaes.length
                ? `Lista · CNAE`
                : `Lista · ${filters.ufs.join("/") || "BR"}`;
      const res = await fetch("/api/search/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, filters }),
      });
      if (!res.ok) throw new Error("Não foi possível montar o grid");
      return (await res.json()) as GridSearch;
    },
    onSuccess: (search) => {
      clearDraft();
      router.push(gridHref(search.id, "largada"));
    },
  });

  const count = showCountPanel && liveReady ? countQuery.data : undefined;
  const canContinueStep1 = hasCountScope(filters);
  const pageTitle =
    mode === "ajustar"
      ? COPY.ajustarBusca
      : mode === "continuar"
        ? COPY.continuarLista
        : COPY.novaLista;
  const pageHint =
    mode === "ajustar"
      ? COPY.largadaAjustarHint
      : mode === "continuar"
        ? COPY.largadaContinuarHint
        : COPY.largadaNovaHint;
  const shellBack =
    mode === "ajustar" && (sourceSearchId || fromSearchParam)
      ? {
          href: gridHref(sourceSearchId || fromSearchParam!, fromParam),
          label: "Voltar ao Grid",
        }
      : BACK.box;

  function NicheGroup({
    title,
    hint,
    items,
  }: {
    title: string;
    hint: string;
    items: NicheTree[];
  }) {
    return (
      <GlassCard className="p-5">
        <h3 className="font-bold text-podium-yellow">{title}</h3>
        <Hint className="mt-1">{hint}</Hint>
        <div className="mt-3 space-y-2">
          {items.map((n) => {
            const open = openNiche === n.id;
            const selectedCount = n.segments.filter((s) =>
              filters.segmentIds.includes(s.id),
            ).length;
            return (
              <div key={n.id} className="rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setOpenNiche(open ? null : n.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-bold">{n.nome}</span>
                    <span className="text-xs text-podium-muted">
                      {n.segments.length} segmentos
                      {selectedCount > 0 ? ` · ${selectedCount} selecionado` : ""}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-podium-muted transition",
                      open && "rotate-180",
                    )}
                  />
                </button>
                {open && (
                  <div className="grid gap-2 border-t border-white/10 p-3 sm:grid-cols-2">
                    {n.segments.map((s) => {
                      const on = filters.segmentIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSegment(s.id)}
                          className={cn(
                            "rounded-xl border px-3 py-3 text-left text-sm transition",
                            on
                              ? "border-podium-yellow/40 bg-podium-yellow/10"
                              : "border-white/10 hover:border-white/25",
                          )}
                        >
                          <span className="font-bold">{s.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>
    );
  }

  if (!hydrated) {
    return (
      <AppShell title="Nova lista" back={BACK.box}>
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      </AppShell>
    );
  }

  return (
    <AppShell title="Nova lista" back={shellBack}>
      <div
        className={cn(
          "grid gap-6",
          showVolumeAside && "lg:grid-cols-[1fr_280px]",
        )}
      >
        <div className="space-y-6">
          <div>
            <SectionTitle>{pageTitle}</SectionTitle>
            {mode !== "nova" ? (
              <Hint className="mt-2 text-sm">{pageHint}</Hint>
            ) : null}
            {mode === "ajustar" && sourceNome ? (
              <p className="mt-2 text-xs font-bold text-podium-yellow">
                Ajustando: {sourceNome}. {COPY.listaOriginalNaoSome}.
              </p>
            ) : null}
            {step > 1 ? (
              <div className="mt-3">
                <BackLink onClick={() => setStep(step - 1)}>
                  {step === 2 ? "Voltar ao nicho" : "Voltar à região"}
                </BackLink>
              </div>
            ) : null}
            <div className="mt-4 flex gap-2">
              {(
                [
                  [1, "Nicho"],
                  [2, "Região"],
                  [3, "Qualidade"],
                ] as const
              ).map(([n, label]) => {
                const filled = filterStepFilled(n, filters);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setStep(n)}
                    className={cn(
                      "rounded-xl px-3 py-1.5 text-xs font-bold",
                      step === n
                        ? "bg-podium-yellow text-podium-navy"
                        : filled
                          ? "border border-podium-yellow/40 bg-white/5 text-podium-yellow"
                          : "bg-white/5 text-podium-muted",
                    )}
                  >
                    {n} {label}
                  </button>
                );
              })}
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              {(filters.intentQuery || filters.cnpjs.length > 0) && (
                <div className="flex flex-wrap gap-2">
                  {filters.intentQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        patch({ intentQuery: null });
                        setIntentDraft("");
                      }}
                      className="rounded-lg bg-podium-yellow/15 px-2.5 py-1 text-xs font-bold text-podium-yellow"
                    >
                      {filters.intentQuery} ×
                    </button>
                  ) : null}
                  {filters.cnpjs.map((cnpj) => (
                    <button
                      key={cnpj}
                      type="button"
                      onClick={() =>
                        patch({
                          cnpjs: filters.cnpjs.filter((c) => c !== cnpj),
                        })
                      }
                      className="rounded-lg bg-podium-yellow/15 px-2.5 py-1 text-xs font-bold text-podium-yellow"
                    >
                      {companyLabels[cnpj] ?? formatCnpj(cnpj)} ×
                    </button>
                  ))}
                </div>
              )}

              {treeQuery.isLoading ? (
                <div className="space-y-3">
                  <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
                  <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
                </div>
              ) : filters.segmentIds.length > 0 ? null : (
                <>
                  <NicheGroup title="B2C local" hint={COPY.b2c} items={b2c} />
                  <NicheGroup
                    title="B2B e indústria"
                    hint={COPY.b2b}
                    items={b2b}
                  />
                </>
              )}

              {filters.segmentIds.length > 0 && (
                <div>
                  <div className="flex flex-wrap gap-2">
                    {filters.segmentIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleSegment(id)}
                        className="rounded-lg bg-podium-yellow/15 px-2.5 py-1 text-xs font-bold text-podium-yellow"
                      >
                        {segmentNames.get(id) ?? id} ×
                      </button>
                    ))}
                  </div>
                  <Hint className="mt-2">Toque no nicho para escolher outro.</Hint>
                </div>
              )}

              <GlassCard className="p-5" highlight>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold">
                      Buscar e refinar atividade (CNAE)
                    </h3>
                    <Hint className="mt-1">
                      {COPY.cnae} Busque qualquer código ou descrição — não só os
                      do segmento.
                    </Hint>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCnaePanel((v) => !v)}
                    className="rounded-xl border border-podium-yellow/30 px-4 py-2 text-xs font-bold text-podium-yellow"
                  >
                    {showCnaePanel ? "Ocultar atividades" : "Ver atividades (CNAE)"}
                  </button>
                </div>
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-podium-muted" />
                  <input
                    value={cnaeDraft}
                    onChange={(e) => setCnaeDraft(e.target.value)}
                    placeholder="Buscar CNAE (código ou descrição)"
                    className="w-full rounded-xl border border-white/10 bg-podium-panel py-3 pl-10 pr-3 text-sm outline-none focus:border-podium-yellow/40"
                  />
                </div>
                {cnaeQ.trim().length >= 2 && (
                  <div className="mt-2 max-h-48 space-y-1 overflow-auto">
                    {(cnaeSearchQuery.data ?? [])
                      .filter((c) => !filters.cnaes.includes(c.codigo))
                      .map((c) => (
                        <button
                          key={c.codigo}
                          type="button"
                          onClick={() => addCnaeFromSearch(c.codigo, c.descricao)}
                          className="flex w-full flex-col rounded-xl border border-white/10 px-3 py-2 text-left hover:border-podium-yellow/40"
                        >
                          <span className="text-sm">
                            <span className="font-mono text-xs text-podium-muted">
                              {formatCnae(c.codigo) ?? c.codigo}
                            </span>{" "}
                            {c.descricao}
                          </span>
                          <span className="text-xs text-podium-muted">
                            {c.count} empresas
                          </span>
                        </button>
                      ))}
                  </div>
                )}
                {filters.cnaes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {filters.cnaes.map((codigo) => (
                      <button
                        key={codigo}
                        type="button"
                        onClick={() => toggleCnae(codigo)}
                        className="rounded-lg bg-white/10 px-2.5 py-1 text-xs text-podium-gray"
                      >
                        {formatCnae(codigo) ?? codigo}
                        {cnaeLabels[codigo] ? ` · ${cnaeLabels[codigo]}` : ""} ×
                      </button>
                    ))}
                  </div>
                )}
                {showCnaePanel && (
                  <div className="mt-4 max-h-64 space-y-2 overflow-auto">
                    {(cnaePreview.data ?? []).length === 0 ? (
                      <p className="text-sm text-podium-muted">
                        Selecione segmentos ou uma intenção para listar as
                        atividades do nicho — ou busque um CNAE acima.
                      </p>
                    ) : (
                      (cnaePreview.data ?? []).map((c) => {
                        const on = filters.cnaes.includes(c.codigo);
                        return (
                          <label
                            key={c.codigo}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5",
                              on
                                ? "border-podium-yellow/40 bg-podium-yellow/10"
                                : "border-white/10",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggleCnae(c.codigo)}
                              className="mt-1 accent-podium-yellow"
                            />
                            <span className="text-sm">
                              <span className="font-mono text-xs text-podium-muted">
                                {c.codigo}
                              </span>{" "}
                              <span className="font-medium">{c.descricao}</span>
                              <span className="mt-0.5 block text-xs text-podium-muted">
                                {c.count} empresas
                              </span>
                            </span>
                          </label>
                        );
                      })
                    )}
                    {filters.cnaes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => patch({ cnaes: [] })}
                        className="text-xs text-podium-muted underline"
                      >
                        Limpar atividades selecionadas (usar só segmentos)
                      </button>
                    )}
                  </div>
                )}
              </GlassCard>

              <button
                type="button"
                disabled={!canContinueStep1}
                onClick={() => setStep(2)}
                className="rounded-xl bg-podium-yellow px-5 py-3 text-sm font-bold text-podium-navy disabled:opacity-40"
              >
                Continuar para região
              </button>
            </div>
          )}

          {step === 2 && (
            <GlassCard className="space-y-4 p-5">
              <h3 className="font-bold">Região — um estado</h3>
              <p className="text-xs text-podium-muted">
                Escolha um estado. Depois você pode refinar por município.
              </p>
              {filters.ufs.length === 1 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-xl bg-podium-yellow px-3 py-2 text-sm font-bold text-podium-navy">
                    {filters.ufs[0]}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-bold text-podium-yellow"
                    onClick={() => patch({ ufs: [], municipioIds: [] })}
                  >
                    Trocar estado
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {ALL_UFS.map((uf) => (
                    <button
                      key={uf}
                      type="button"
                      onClick={() => patch({ ufs: [uf], municipioIds: [] })}
                      className="rounded-xl bg-white/5 px-3 py-2 text-sm font-bold text-podium-gray hover:bg-white/10"
                    >
                      {uf}
                    </button>
                  ))}
                </div>
              )}
              <div className="rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setCitiesOpen((open) => !open)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-bold">
                      Refinar por município
                    </span>
                    <span className="text-xs text-podium-muted">
                      {filters.municipioIds.length > 0
                        ? `${filters.municipioIds.length} município${filters.municipioIds.length === 1 ? "" : "s"}`
                        : "Opcional — selecione cidades individualmente"}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-podium-muted transition",
                      citiesOpen && "rotate-180",
                    )}
                  />
                </button>
                {citiesOpen && (
                  <div className="border-t border-white/10 p-3">
                    <p className="mb-2 text-xs text-podium-muted">
                      Sem município selecionado = estado inteiro. Busque municípios pelo nome.
                    </p>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="text-xs font-bold text-podium-yellow"
                        onClick={async () => {
                          const res = await fetch(
                            `/api/ref/municipios?ufs=${filters.ufs.join(",")}&capitals=1`,
                          );
                          const caps = (await res.json()) as Array<{ id: number }>;
                          patch({ municipioIds: caps.map((c) => c.id) });
                        }}
                        disabled={!filters.ufs.length}
                      >
                        Selecionar capitais
                      </button>
                      {filters.municipioIds.length > 0 && (
                        <button
                          type="button"
                          className="text-xs text-podium-muted underline"
                          onClick={() => patch({ municipioIds: [] })}
                        >
                          Limpar (usar o estado inteiro)
                        </button>
                      )}
                    </div>
                    <input
                      value={munQuery}
                      onChange={(e) => setMunQuery(e.target.value)}
                      placeholder="Buscar município…"
                      disabled={!filters.ufs.length}
                      className="mb-3 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 text-sm outline-none focus:border-podium-yellow/40 disabled:opacity-40"
                    />
                    {munLetterOptions.length > 0 ? (
                      <div className="mb-3 flex flex-wrap gap-1">
                        {munLetterOptions.map((letter) => {
                          const on = munLetter === letter;
                          return (
                            <button
                              key={letter}
                              type="button"
                              onClick={() =>
                                setMunLetter(on ? null : letter)
                              }
                              className={cn(
                                "min-w-8 rounded-lg px-2 py-1 text-xs font-bold",
                                on
                                  ? "bg-podium-yellow text-podium-navy"
                                  : "bg-white/5 text-podium-muted hover:text-podium-gray",
                              )}
                            >
                              {letter}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    <div className="flex max-h-56 flex-wrap gap-2 overflow-auto">
                      {municipiosShown.map((m) => {
                        const on = filters.municipioIds.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() =>
                              patch({
                                municipioIds: on
                                  ? filters.municipioIds.filter((id) => id !== m.id)
                                  : [...filters.municipioIds, m.id],
                              })
                            }
                            className={cn(
                              "rounded-xl px-3 py-2 text-xs",
                              on
                                ? "bg-podium-yellow/20 text-podium-yellow"
                                : "bg-white/5 text-podium-muted",
                            )}
                          >
                            {m.nome}/{m.uf}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!filters.ufs.length}
                className="rounded-xl bg-podium-yellow px-5 py-3 text-sm font-bold text-podium-navy disabled:opacity-40"
              >
                Continuar para qualidade
              </button>
            </GlassCard>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <GlassCard className="space-y-3 p-5" highlight>
                <h3 className="text-lg font-extrabold text-podium-yellow">
                  Qualidade do contato
                </h3>
                <ToggleRow
                  checked={filters.ocultarTelefonesCompartilhados}
                  onChange={(v) => patch({ ocultarTelefonesCompartilhados: v })}
                  title="Excluir números de escritório contábil"
                  hint="O mesmo telefone em 3 ou mais empresas costuma ser da contabilidade. Desligue para ver esses números na lista, com a tag Contabilidade."
                  recommended
                />
                <ToggleRow
                  checked={filters.soMatriz}
                  onChange={(v) => patch({ soMatriz: v })}
                  title="Só matriz"
                  hint={COPY.matriz}
                  recommended
                />
                <ToggleRow
                  checked={filters.ocultarEmailsGratuitos}
                  onChange={(v) => patch({ ocultarEmailsGratuitos: v })}
                  title="Ocultar e-mails de provedor gratuito"
                  hint={COPY.emailGratuito}
                />
                <ToggleRow
                  checked={filters.ocultarEnderecosCompartilhados}
                  onChange={(v) => patch({ ocultarEnderecosCompartilhados: v })}
                  title="Excluir endereços de escritório fiscal"
                  hint="O mesmo endereço em várias empresas costuma ser da contabilidade, não da loja."
                />
                <ToggleRow
                  checked={filters.soEnriquecidas}
                  onChange={(v) => patch({ soEnriquecidas: v })}
                  title="Só empresas já qualificadas"
                  hint="Lista só quem já passou pela qualificação. Desligado por padrão."
                />
              </GlassCard>

              <button
                type="button"
                onClick={() => setMoreFilters((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-podium-gray hover:border-white/20"
              >
                Mais filtros
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-podium-muted transition",
                    moreFilters && "rotate-180",
                  )}
                />
              </button>

              {moreFilters ? (
              <GlassCard className="space-y-5 p-5">
                <div>
                  <h3 className="font-bold">Porte</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      ["01", PORTE_LABELS["01"]],
                      ["03", PORTE_LABELS["03"]],
                      ["05", PORTE_LABELS["05"]],
                    ].map(([code, label]) => {
                      const on = filters.portes.includes(code);
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() =>
                            patch({
                              portes: on
                                ? filters.portes.filter((p) => p !== code)
                                : [...filters.portes, code],
                            })
                          }
                          className={cn(
                            "min-h-12 rounded-xl px-5 text-sm font-bold",
                            on
                              ? "bg-podium-yellow text-podium-navy"
                              : "bg-white/5 text-podium-gray",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold">Empresa aberta há mais de</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[0, 3, 5, 10].map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => patch({ idadeMinimaAnos: y })}
                        className={cn(
                          "min-h-12 rounded-xl px-5 text-sm font-bold",
                          filters.idadeMinimaAnos === y
                            ? "bg-podium-yellow text-podium-navy"
                            : "bg-white/5 text-podium-gray",
                        )}
                      >
                        {y === 0 ? "Qualquer" : `${y} anos`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <ToggleRow
                    checked={filters.excluirSimples}
                    onChange={(v) => patch({ excluirSimples: v })}
                    title="Excluir optantes do Simples"
                    hint={COPY.simples}
                  />
                  <ToggleRow
                    checked={filters.exigirEmailProprio}
                    onChange={(v) => patch({ exigirEmailProprio: v })}
                    title="Exigir e-mail de domínio próprio"
                    hint={COPY.dominioProprio}
                  />
                  <ToggleRow
                    checked={filters.exigirDecisor}
                    onChange={(v) => patch({ exigirDecisor: v })}
                    title="Exigir decisor identificado"
                    hint={COPY.decisor}
                  />
                </div>
              </GlassCard>
              ) : null}

              <button
                type="button"
                disabled={runSearch.isPending || !canContinueStep1 || !filters.ufs.length}
                onClick={() => runSearch.mutate()}
                className="w-full rounded-xl bg-podium-yellow py-4 text-sm font-extrabold text-podium-navy disabled:opacity-40"
              >
                {runSearch.isPending
                  ? "Montando grid…"
                  : mode === "ajustar"
                    ? COPY.verNovoGrid
                    : COPY.verResultados}
              </button>
            </div>
          )}
        </div>

        {showVolumeAside ? (
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <GlassCard
            className="fixed inset-x-0 bottom-16 z-30 mx-4 p-4 md:static md:mx-0 md:p-5"
            highlight
          >
            <p className="text-xs uppercase tracking-wide text-podium-gray">
              Empresas nesta busca
            </p>
            {!liveReady ? (
              <>
                <p className="mt-2 text-4xl font-extrabold text-podium-yellow">—</p>
                <p className="mt-2 text-xs text-podium-muted">
                  Escolha o nicho para ver o volume
                </p>
              </>
            ) : !count ? (
              <div className="mt-3 h-12 animate-pulse rounded-xl bg-white/10" />
            ) : (
              <>
                <p className="mt-2 text-4xl font-extrabold text-podium-yellow">
                  {count?.capped
                    ? `${(count.total ?? 0).toLocaleString("pt-BR")}+`
                    : (count?.total ?? 0).toLocaleString("pt-BR")}
                </p>
                {step === 2 ? (
                  <p className="mt-2 text-xs text-podium-muted">
                    {count?.capped
                      ? "Muitas empresas nesta região — refine por município ou ajuste a qualidade no próximo passo."
                      : "Volume na região selecionada. Detalhes de contato no passo Qualidade."}
                  </p>
                ) : null}
              </>
            )}
            {showCountMunicipios && (count?.porMunicipio?.length ?? 0) > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-podium-gray">
                  Onde concentra
                </p>
                <div className="space-y-2">
                  {count!.porMunicipio.map((m: CountResult["porMunicipio"][number]) => (
                    <div key={m.municipio_id}>
                      <div className="mb-1 flex justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate text-podium-gray">
                          {m.uf ? `${m.nome} - ${m.uf}` : m.nome}
                        </span>
                        <span className="shrink-0 text-podium-muted">{m.total}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-podium-yellow/70"
                          style={{
                            width: `${Math.min(
                              100,
                              (m.total / Math.max(count?.total || 1, 1)) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {showCountBreakdown ? (
              <div className="mt-4 space-y-2 text-xs text-podium-muted">
                <p>Com telefone: {count?.comTelefone ?? "—"}</p>
                <p>Com e-mail: {count?.comEmail ?? "—"}</p>
                <p>Com decisor: {count?.comDecisor ?? "—"}</p>
              </div>
            ) : null}
          </GlassCard>
        </aside>
        ) : null}
      </div>
    </AppShell>
  );
}
