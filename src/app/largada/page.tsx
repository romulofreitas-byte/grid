"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BackLink } from "@/components/BackLink";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { ListSummaryBadges } from "@/components/ListSummaryBadges";
import { SectionTitle } from "@/components/SectionTitle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChoiceTile } from "@/components/ui/ChoiceTile";
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
import {
  SEARCH_JOB_POLL_MS,
  SEARCH_JOB_POLL_TIMEOUT_MS,
  SEARCH_JOB_POST_TIMEOUT_MS,
  type SearchJobPublic,
} from "@/lib/search-jobs";
import { cn } from "@/lib/utils";
import { normalizeText } from "@/lib/niches";
import {
  presetMatchesQuery,
  rankPresetMatch,
  rankTextMatch,
} from "@/lib/segment-aliases";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "TimeoutError" || err.name === "AbortError")
  );
}

async function waitForSearchJob(
  jobId: string,
  onQueue: (position: number) => void,
): Promise<GridSearch> {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const res = await fetch(`/api/search/jobs/${encodeURIComponent(jobId)}`, {
      signal: AbortSignal.timeout(SEARCH_JOB_POLL_TIMEOUT_MS),
    });
    const body = (await res.json()) as SearchJobPublic & { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? "Não foi possível montar a lista");
    }
    onQueue(body.queuePosition);
    if (body.status === "done" && body.search) return body.search;
    if (body.status === "done") {
      throw new Error("Não foi possível montar a lista");
    }
    if (body.status === "failed") {
      throw new Error(body.error ?? "Não foi possível montar a lista");
    }
    await sleep(SEARCH_JOB_POLL_MS);
  }
  throw new Error("A fila está demorando. Abra Minhas listas em instantes.");
}

type NicheTree = {
  id: string;
  slug?: string;
  nome: string;
  grupo: string;
  aliases?: string[];
  keywords?: string[];
  segments: Array<{
    id: string;
    nome: string;
    slug?: string;
    aliases?: string[];
    keywords?: string[];
  }>;
};

const PICKER_CNAE_LIMIT = 10;

function segmentFields(
  niche: Pick<NicheTree, "nome">,
  seg: NicheTree["segments"][number],
) {
  return {
    nome: seg.nome,
    slug: seg.slug,
    aliases: seg.aliases,
    keywords: seg.keywords,
    parentNome: niche.nome,
  };
}

const ALL_UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function cnaeScopeKey(
  segmentIds: string[],
  intentQuery: string | null | undefined,
): string {
  return `${[...segmentIds].sort().join(",")}|${intentQuery ?? ""}`;
}

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
        checked
          ? "border-white/25 bg-white/[0.06]"
          : "border-white/10 bg-white/[0.02] hover:border-white/20",
      )}
    >
      <span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-podium-white">{title}</span>
          {recommended ? (
            <span className="rounded-lg border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-podium-muted">
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
          checked ? "bg-podium-yellow/80" : "bg-white/15",
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

function formatCountTotal(count: CountResult): string {
  return count.capped
    ? `${(count.total ?? 0).toLocaleString("pt-BR")}+`
    : (count.total ?? 0).toLocaleString("pt-BR");
}

function VolumeCompactTotal({
  liveReady,
  count,
  isFetching,
}: {
  liveReady: boolean;
  count: CountResult | undefined;
  isFetching: boolean;
}) {
  if (!liveReady) {
    return (
      <p className="text-sm text-podium-muted">
        Escolha o nicho para ver o volume
      </p>
    );
  }
  if (!count) {
    return <div className="h-5 w-28 animate-pulse rounded-md bg-white/10" />;
  }
  return (
    <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-lg font-extrabold text-podium-yellow">
        {formatCountTotal(count)}
      </span>
      <span className="text-xs text-podium-muted">empresas</span>
      {isFetching ? (
        <span className="text-xs text-podium-yellow">{COPY.filaContando}</span>
      ) : null}
    </p>
  );
}

function VolumeMunicipioBars({
  municipios,
  total,
}: {
  municipios: CountResult["porMunicipio"];
  total: number;
}) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-podium-gray">
        Onde concentra
      </p>
      <div className="space-y-2">
        {municipios.map((m) => (
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
                  width: `${Math.min(100, (m.total / Math.max(total, 1)) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VolumeBreakdown({ count }: { count: CountResult | undefined }) {
  return (
    <div className="mt-4 space-y-2 text-xs text-podium-muted">
      <p>Com telefone: {count?.comTelefone ?? "—"}</p>
      <p>Com e-mail: {count?.comEmail ?? "—"}</p>
      <p>Com decisor: {count?.comDecisor ?? "—"}</p>
    </div>
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
  const [segmentQuery, setSegmentQuery] = useState("");
  const [intentDraft, setIntentDraft] = useState("");
  const [munQuery, setMunQuery] = useState("");
  const [munLetter, setMunLetter] = useState<string | null>(null);
  const [citiesOpen, setCitiesOpen] = useState(false);
  const [showCnaePanel, setShowCnaePanel] = useState(true);
  const [cnaeDraft, setCnaeDraft] = useState("");
  const [companyLabels, setCompanyLabels] = useState<Record<string, string>>({});
  const [cnaeLabels, setCnaeLabels] = useState<Record<string, string>>({});
  const [queuePosition, setQueuePosition] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<"nova" | "continuar" | "ajustar">("nova");
  const [sourceNome, setSourceNome] = useState<string | null>(null);
  const [sourceSearchId, setSourceSearchId] = useState<string | null>(null);
  const [moreFilters, setMoreFilters] = useState(false);
  const [volumeExpanded, setVolumeExpanded] = useState(false);
  const autoOpenedNiche = useRef(false);
  /** Evita reaplicar o default de CNAEs no mesmo escopo (segmento/intenção). */
  const autoCnaeScopeKey = useRef<string | null>(null);

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
          autoCnaeScopeKey.current =
            next.cnaes.length > 0
              ? cnaeScopeKey(next.segmentIds, next.intentQuery)
              : null;
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
        autoCnaeScopeKey.current =
          next.cnaes.length > 0
            ? cnaeScopeKey(next.segmentIds, next.intentQuery)
            : null;
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
    if (step !== 3) setVolumeExpanded(false);
  }, [step]);

  useEffect(() => {
    if (!volumeExpanded) return;
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setVolumeExpanded(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [volumeExpanded]);

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
      filters.ufs,
    ],
    queryFn: async () => {
      const res = await fetch("/api/niches/cnae-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentIds: filters.segmentIds,
          intentQuery: filters.intentQuery,
          cnaes: [] as string[],
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
      filters.segmentIds.length > 0 ||
      (!!filters.intentQuery && filters.intentQuery.length >= 2),
  });

  useEffect(() => {
    const rows = cnaePreview.data;
    if (!rows?.length) return;
    if (filters.segmentIds.length === 0 && !filters.intentQuery) return;
    const key = cnaeScopeKey(filters.segmentIds, filters.intentQuery);
    if (autoCnaeScopeKey.current === key) return;
    autoCnaeScopeKey.current = key;
    setCnaeLabels((m) => {
      const next = { ...m };
      for (const r of rows) next[r.codigo] = r.descricao;
      return next;
    });
    setShowCnaePanel(true);
    if (filters.segmentIds.length === 0 && filters.intentQuery) return;
    const codes = rows.map((r) => r.codigo);
    setFilters((f) => ({ ...f, cnaes: codes }));
  }, [cnaePreview.data, filters.segmentIds, filters.intentQuery]);

  const pickerCnaeQ = useDebounced(segmentQuery, 300);
  const pickerCnaeQuery = useQuery({
    queryKey: ["cnae-picker", pickerCnaeQ],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/ref/cnaes?q=${encodeURIComponent(pickerCnaeQ.trim())}`,
        { signal },
      );
      return (await res.json()) as Array<{
        codigo: string;
        descricao: string;
        count: number;
      }>;
    },
    enabled:
      pickerCnaeQ.trim().length >= 2 &&
      filters.segmentIds.length === 0 &&
      !filters.intentQuery,
  });
  const pickerCnaes = useMemo(() => {
    const rows = Array.isArray(pickerCnaeQuery.data) ? pickerCnaeQuery.data : [];
    return rows
      .slice()
      .sort(
        (a, b) =>
          rankTextMatch(b.descricao, segmentQuery) -
            rankTextMatch(a.descricao, segmentQuery) || b.count - a.count,
      )
      .slice(0, PICKER_CNAE_LIMIT);
  }, [pickerCnaeQuery.data, segmentQuery]);

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
  const segmentSearch = normalizeText(segmentQuery);
  const filteredNicheTree = useMemo(() => {
    if (!segmentSearch) return nicheTree;
    return nicheTree
      .map((n) => {
        const nicheHit = presetMatchesQuery(
          {
            nome: n.nome,
            slug: n.slug,
            aliases: n.aliases,
            keywords: n.keywords,
          },
          segmentQuery,
        );
        const segments = (
          nicheHit
            ? n.segments
            : n.segments.filter((s) =>
                presetMatchesQuery(segmentFields(n, s), segmentQuery),
              )
        )
          .slice()
          .sort(
            (a, b) =>
              rankPresetMatch(segmentFields(n, b), segmentQuery) -
              rankPresetMatch(segmentFields(n, a), segmentQuery),
          );
        return { ...n, segments };
      })
      .filter((n) => n.segments.length > 0)
      .sort((a, b) => {
        const score = (n: NicheTree) =>
          Math.max(
            0,
            ...n.segments.map((s) =>
              rankPresetMatch(segmentFields(n, s), segmentQuery),
            ),
          );
        return score(b) - score(a);
      });
  }, [nicheTree, segmentSearch, segmentQuery]);
  const b2c = useMemo(
    () => filteredNicheTree.filter((n) => n.grupo === "b2c_local"),
    [filteredNicheTree],
  );
  const b2b = useMemo(
    () => filteredNicheTree.filter((n) => n.grupo === "b2b_industria"),
    [filteredNicheTree],
  );
  const matchedSegmentCount = useMemo(
    () => filteredNicheTree.reduce((n, x) => n + x.segments.length, 0),
    [filteredNicheTree],
  );

  useEffect(() => {
    if (!segmentSearch || filteredNicheTree.length === 0) return;
    setOpenNiche((prev) => {
      if (prev && filteredNicheTree.some((n) => n.id === prev)) return prev;
      return filteredNicheTree[0]?.id ?? null;
    });
  }, [segmentSearch, filteredNicheTree]);

  function applyIntentFromSearch() {
    const q = segmentQuery.trim();
    if (q.length < 2) return;
    autoCnaeScopeKey.current = null;
    setFilters((f) => ({
      ...f,
      presetId: null,
      segmentIds: [],
      intentQuery: q,
      cnaes: [],
    }));
    setSegmentQuery("");
    setShowCnaePanel(true);
  }

  function onSegmentSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!segmentSearch) return;
    const ranked = filteredNicheTree
      .flatMap((n) => n.segments.map((s) => ({ nicheId: n.id, seg: s, niche: n })))
      .map((x) => ({
        ...x,
        score: rankPresetMatch(segmentFields(x.niche, x.seg), segmentQuery),
      }))
      .sort((a, b) => b.score - a.score);
    const top = ranked[0];
    if (top && top.score >= 70 && (ranked.length === 1 || top.score > (ranked[1]?.score ?? 0))) {
      setOpenNiche(top.nicheId);
      toggleSegment(top.seg.id);
      setSegmentQuery("");
      return;
    }
    applyIntentFromSearch();
  }

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
  const municipioNames = useMemo(() => {
    const map: Record<number, string> = {};
    for (const m of municipiosAll) map[m.id] = m.nome;
    return map;
  }, [municipiosAll]);
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
      autoCnaeScopeKey.current = null;
      return {
        ...f,
        presetId: null,
        segmentIds: has ? [] : [id],
        intentQuery: has ? f.intentQuery : null,
        cnaes: [],
      };
    });
    setShowCnaePanel(true);
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

  function pickCnaeAsNiche(codigo: string, descricao: string) {
    autoCnaeScopeKey.current = null;
    setCnaeLabels((m) => ({ ...m, [codigo]: descricao }));
    setFilters((f) => ({
      ...f,
      presetId: null,
      segmentIds: [],
      intentQuery: null,
      cnaes: [codigo],
    }));
    setSegmentQuery("");
    setShowCnaePanel(true);
  }

  const runSearch = useMutation({
    mutationKey: ["search-run"],
    mutationFn: async () => {
      setQueuePosition(0);
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
      try {
        const res = await fetch("/api/search/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome, filters }),
          signal: AbortSignal.timeout(SEARCH_JOB_POST_TIMEOUT_MS),
        });
        const body = (await res.json()) as SearchJobPublic & { error?: string };
        if (!res.ok) {
          throw new Error(body.error ?? "Não foi possível montar a lista");
        }
        if (body.search?.id) return body.search;
        if (!body.jobId) throw new Error("Não foi possível montar a lista");
        setQueuePosition(body.queuePosition);
        return await waitForSearchJob(body.jobId, setQueuePosition);
      } catch (err) {
        if (isAbortError(err)) {
          throw new Error("A fila está demorando. Abra Minhas listas em instantes.");
        }
        throw err;
      }
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
          label: "Voltar à lista",
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
    if (items.length === 0) return null;
    return (
      <GlassCard className="p-5">
        <h3 className="font-bold text-podium-yellow">{title}</h3>
        <Hint className="mt-1">{hint}</Hint>
        <div className="mt-3 space-y-2">
          {items.map((n) => {
            const open = openNiche === n.id || (!!segmentSearch && items.length <= 3);
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
                      const nameHit =
                        !!segmentSearch &&
                        rankPresetMatch(segmentFields(n, s), segmentQuery) >= 70;
                      return (
                        <ChoiceTile
                          key={s.id}
                          density="card"
                          selected={on}
                          onClick={() => toggleSegment(s.id)}
                          className={nameHit ? "ring-1 ring-podium-yellow/50" : undefined}
                        >
                          {s.nome}
                        </ChoiceTile>
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
          showVolumeAside &&
            (volumeExpanded
              ? "pb-[calc(40vh+5.5rem)] md:pb-0"
              : "pb-20 md:pb-0"),
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
                  <Button
                    key={n}
                    size="sm"
                    variant={
                      step === n ? "accent" : filled ? "secondary" : "ghost"
                    }
                    onClick={() => setStep(n)}
                    className={cn(
                      step !== n &&
                        filled &&
                        "border-podium-yellow/30 text-podium-yellow",
                    )}
                  >
                    {n} {label}
                  </Button>
                );
              })}
            </div>
            <ListSummaryBadges
              filters={filters}
              municipioNames={municipioNames}
              sticky
              includeSemContabil={step === 3}
              className="mt-3"
            />
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
                    >
                      <Badge variant="accent">
                        {filters.intentQuery} ×
                      </Badge>
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
                    >
                      <Badge variant="accent">
                        {companyLabels[cnpj] ?? formatCnpj(cnpj)} ×
                      </Badge>
                    </button>
                  ))}
                </div>
              )}

              {treeQuery.isLoading ? (
                <div className="space-y-3">
                  <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
                  <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
                </div>
              ) : filters.segmentIds.length > 0 || filters.intentQuery ? null : (
                <>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-podium-muted" />
                      <input
                        value={segmentQuery}
                        onChange={(e) => setSegmentQuery(e.target.value)}
                        onKeyDown={onSegmentSearchKeyDown}
                        placeholder="Buscar nicho (ex.: barbearia, clínica médica, farmácia)"
                        className="w-full rounded-xl border border-white/10 bg-podium-panel py-3 pl-10 pr-3 text-sm outline-none focus:border-podium-yellow/40"
                      />
                    </div>
                    {segmentSearch.length >= 2 ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Hint>
                          {matchedSegmentCount > 0
                            ? `${matchedSegmentCount} segmento${matchedSegmentCount === 1 ? "" : "s"}`
                            : "Nenhum segmento com esse nome"}
                          {pickerCnaes.length > 0
                            ? ` · ${pickerCnaes.length} atividade${pickerCnaes.length === 1 ? "" : "s"} da Receita`
                            : ""}
                          {matchedSegmentCount > 0
                            ? " · Enter seleciona o melhor match"
                            : ""}
                        </Hint>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={applyIntentFromSearch}
                        >
                          Buscar pelo termo “{segmentQuery.trim()}”
                        </Button>
                      </div>
                    ) : null}
                    {segmentSearch.length >= 2 && pickerCnaes.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-podium-muted">
                          Atividades da Receita
                        </p>
                        <div className="max-h-48 space-y-1 overflow-auto">
                          {pickerCnaes.map((c) => (
                            <ChoiceTile
                              key={c.codigo}
                              density="row"
                              selected={filters.cnaes.includes(c.codigo)}
                              onClick={() => pickCnaeAsNiche(c.codigo, c.descricao)}
                              meta={`${c.count} empresas`}
                            >
                              <span className="font-mono text-xs text-podium-muted">
                                {formatCnae(c.codigo) ?? c.codigo}
                              </span>{" "}
                              {c.descricao}
                            </ChoiceTile>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <NicheGroup title="B2C local" hint={COPY.b2c} items={b2c} />
                  <NicheGroup
                    title="B2B"
                    hint={COPY.b2b}
                    items={b2b}
                  />
                </>
              )}

              {filters.segmentIds.length > 0 ? (
                <div>
                  <div className="flex flex-wrap gap-2">
                    {filters.segmentIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleSegment(id)}
                      >
                        <Badge variant="accent">
                          {segmentNames.get(id) ?? id} ×
                        </Badge>
                      </button>
                    ))}
                  </div>
                  <Hint className="mt-2">Toque no nicho para escolher outro.</Hint>
                </div>
              ) : null}

              <GlassCard className="p-5" highlight>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      Buscar e refinar atividade (CNAE)
                    </h3>
                    <Hint className="mt-1">
                      {COPY.cnae} Busque qualquer código ou descrição — não só os
                      do segmento. As atividades do nicho já vêm marcadas;
                      desmarque o que quiser tirar da lista.
                    </Hint>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowCnaePanel((v) => !v)}
                  >
                    {showCnaePanel ? "Ocultar atividades" : "Mostrar atividades"}
                  </Button>
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
                        <ChoiceTile
                          key={c.codigo}
                          density="row"
                          selected={false}
                          onClick={() =>
                            addCnaeFromSearch(c.codigo, c.descricao)
                          }
                          meta={`${c.count} empresas`}
                        >
                          <span className="font-mono text-xs text-podium-muted">
                            {formatCnae(c.codigo) ?? c.codigo}
                          </span>{" "}
                          {c.descricao}
                        </ChoiceTile>
                      ))}
                  </div>
                )}
                {filters.cnaes.length > 0 && (
                  <div className="mt-3">
                    <Hint>
                      {filters.cnaes.length}{" "}
                      {filters.cnaes.length === 1
                        ? "atividade selecionada"
                        : "atividades selecionadas"}
                    </Hint>
                    <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
                      {filters.cnaes.map((codigo) => (
                        <button
                          key={codigo}
                          type="button"
                          title={cnaeLabels[codigo] ?? codigo}
                          onClick={() => toggleCnae(codigo)}
                        >
                          <Badge variant="neutral">
                            {formatCnae(codigo) ?? codigo} ×
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {showCnaePanel && (
                  <div className="mt-4 max-h-64 space-y-2 overflow-auto">
                    {cnaePreview.isLoading ? (
                      <p className="text-sm text-podium-muted">
                        Carregando atividades do nicho…
                      </p>
                    ) : (cnaePreview.data ?? []).length === 0 ? (
                      <p className="text-sm text-podium-muted">
                        {filters.segmentIds.length > 0
                          ? "Nenhuma atividade da Receita casou com este nicho — busque um CNAE acima."
                          : "Selecione um segmento ou uma intenção para listar as atividades do nicho — ou busque um CNAE acima."}
                      </p>
                    ) : (
                      (cnaePreview.data ?? []).map((c) => {
                        const on = filters.cnaes.includes(c.codigo);
                        return (
                          <ChoiceTile
                            key={c.codigo}
                            density="row"
                            selected={on}
                            onClick={() => {
                              if (!on) {
                                setCnaeLabels((m) => ({
                                  ...m,
                                  [c.codigo]: c.descricao,
                                }));
                              }
                              toggleCnae(c.codigo);
                            }}
                            meta={`${c.count} empresas`}
                          >
                            <span className="font-mono text-xs text-podium-muted">
                              {formatCnae(c.codigo) ?? c.codigo}
                            </span>{" "}
                            <span className="font-medium text-podium-white">
                              {c.descricao}
                            </span>
                          </ChoiceTile>
                        );
                      })
                    )}
                    {filters.cnaes.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          autoCnaeScopeKey.current = cnaeScopeKey(
                            filters.segmentIds,
                            filters.intentQuery,
                          );
                          patch({ cnaes: [] });
                        }}
                        className="underline"
                      >
                        Limpar atividades selecionadas (usar só segmentos)
                      </Button>
                    )}
                  </div>
                )}
              </GlassCard>

              <Button
                variant="primary"
                size="lg"
                disabled={!canContinueStep1}
                onClick={() => setStep(2)}
              >
                Continuar para região
              </Button>
            </div>
          )}

          {step === 2 && (
            <GlassCard className="space-y-4 p-5">
              <h3 className="font-semibold">Região — um estado</h3>
              <p className="text-xs text-podium-muted">
                Escolha um estado. Depois você pode refinar por município.
              </p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-9">
                {ALL_UFS.map((uf) => {
                  const on = filters.ufs[0] === uf;
                  return (
                    <ChoiceTile
                      key={uf}
                      density="compact"
                      selected={on}
                      aria-label={`Estado ${uf}`}
                      onClick={() => {
                        if (on) return;
                        patch({ ufs: [uf], municipioIds: [] });
                      }}
                    >
                      {uf}
                    </ChoiceTile>
                  );
                })}
              </div>
              {filters.ufs.length === 1 ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Badge variant="accent">{filters.ufs[0]}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => patch({ ufs: [], municipioIds: [] })}
                  >
                    Limpar estado
                  </Button>
                </div>
              ) : null}
              <div className="rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setCitiesOpen((open) => !open)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-semibold">
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
                      Sem município selecionado = estado inteiro. Busque
                      municípios pelo nome.
                    </p>
                    <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const res = await fetch(
                            `/api/ref/municipios?ufs=${filters.ufs.join(",")}&capitals=1`,
                          );
                          const caps = (await res.json()) as Array<{
                            id: number;
                          }>;
                          patch({ municipioIds: caps.map((c) => c.id) });
                        }}
                        disabled={!filters.ufs.length}
                      >
                        Selecionar capitais
                      </Button>
                      {filters.municipioIds.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => patch({ municipioIds: [] })}
                        >
                          Limpar (usar o estado inteiro)
                        </Button>
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
                      <div className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1">
                        {munLetterOptions.map((letter) => {
                          const on = munLetter === letter;
                          return (
                            <ChoiceTile
                              key={letter}
                              density="compact"
                              selected={on}
                              className="min-h-8 text-xs"
                              onClick={() =>
                                setMunLetter(on ? null : letter)
                              }
                            >
                              {letter}
                            </ChoiceTile>
                          );
                        })}
                      </div>
                    ) : null}
                    <div className="grid max-h-56 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3 md:grid-cols-4">
                      {municipiosShown.map((m) => {
                        const on = filters.municipioIds.includes(m.id);
                        return (
                          <ChoiceTile
                            key={m.id}
                            density="chip"
                            selected={on}
                            className="min-w-0 flex-none"
                            onClick={() =>
                              patch({
                                municipioIds: on
                                  ? filters.municipioIds.filter(
                                      (id) => id !== m.id,
                                    )
                                  : [...filters.municipioIds, m.id],
                              })
                            }
                          >
                            <span className="truncate">
                              {m.nome}
                              <span className="text-podium-muted">/{m.uf}</span>
                            </span>
                          </ChoiceTile>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setStep(3)}
                disabled={!filters.ufs.length}
                className={cn(showVolumeAside && "max-md:scroll-mb-32")}
              >
                Continuar para qualidade
              </Button>
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
                  hint="Ligado: a lista esconde números de escritório contábil. Desligado: eles aparecem com a tag Contabilidade. Empresas do mesmo grupo continuam na lista."
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
                className="flex w-full items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-podium-gray hover:border-white/20"
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
                  <h3 className="font-semibold">Porte</h3>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {[
                      ["01", PORTE_LABELS["01"]],
                      ["03", PORTE_LABELS["03"]],
                      ["05", PORTE_LABELS["05"]],
                    ].map(([code, label]) => {
                      const on = filters.portes.includes(code);
                      return (
                        <ChoiceTile
                          key={code}
                          density="card"
                          selected={on}
                          onClick={() =>
                            patch({
                              portes: on
                                ? filters.portes.filter((p) => p !== code)
                                : [...filters.portes, code],
                            })
                          }
                        >
                          {label}
                        </ChoiceTile>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold">Empresa aberta há mais de</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[0, 3, 5, 10].map((y) => (
                      <ChoiceTile
                        key={y}
                        density="compact"
                        selected={filters.idadeMinimaAnos === y}
                        onClick={() => patch({ idadeMinimaAnos: y })}
                      >
                        {y === 0 ? "Qualquer" : `${y} anos`}
                      </ChoiceTile>
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

              <Button
                variant="primary"
                size="lg"
                disabled={
                  runSearch.isPending || !canContinueStep1 || !filters.ufs.length
                }
                onClick={() => runSearch.mutate()}
                className={cn(
                  "w-full",
                  showVolumeAside &&
                    (volumeExpanded
                      ? "max-md:scroll-mb-[calc(40vh+8rem)]"
                      : "max-md:scroll-mb-32"),
                )}
              >
                {runSearch.isPending
                  ? queuePosition > 1
                    ? `Na fila · ${queuePosition} à frente`
                    : COPY.filaMontando
                  : mode === "ajustar"
                    ? COPY.verNovoGrid
                    : COPY.verResultados}
              </Button>
              {runSearch.isPending && queuePosition > 1 ? (
                <p className="mt-2 text-center text-xs text-podium-muted">
                  {COPY.filaPodeFechar}
                </p>
              ) : null}
              {runSearch.error ? (
                <p className="mt-2 text-center text-xs text-podium-alert">
                  {runSearch.error.message}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {showVolumeAside ? (
        <aside className="lg:sticky lg:top-20 lg:self-start">
          {volumeExpanded ? (
            <button
              type="button"
              aria-label="Fechar detalhes do volume"
              className="fixed inset-0 z-20 bg-black/40 md:hidden"
              onClick={() => setVolumeExpanded(false)}
            />
          ) : null}
          <GlassCard
            className="fixed inset-x-0 bottom-16 z-30 mx-4 overflow-hidden p-0 md:static md:mx-0 md:p-5"
            highlight
          >
            <div className="md:hidden">
              {step === 3 ? (
                <button
                  type="button"
                  aria-expanded={volumeExpanded}
                  aria-controls="volume-details-mobile"
                  onClick={() => setVolumeExpanded((open) => !open)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <VolumeCompactTotal
                    liveReady={liveReady}
                    count={count}
                    isFetching={countQuery.isFetching}
                  />
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-podium-muted transition",
                      volumeExpanded && "rotate-180",
                    )}
                  />
                </button>
              ) : (
                <div className="px-4 py-3">
                  <VolumeCompactTotal
                    liveReady={liveReady}
                    count={count}
                    isFetching={countQuery.isFetching}
                  />
                </div>
              )}
              {step === 3 && volumeExpanded ? (
                <div
                  id="volume-details-mobile"
                  className="max-h-[40vh] overflow-y-auto border-t border-white/10 px-4 pb-3"
                >
                  {showCountMunicipios &&
                  (count?.porMunicipio?.length ?? 0) > 0 ? (
                    <VolumeMunicipioBars
                      municipios={count!.porMunicipio}
                      total={count?.total || 1}
                    />
                  ) : null}
                  {showCountBreakdown ? (
                    <VolumeBreakdown count={count} />
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="hidden md:block">
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
                  {formatCountTotal(count)}
                </p>
                {countQuery.isFetching ? (
                  <p className="mt-1 text-xs text-podium-yellow">
                    {COPY.filaContando}
                  </p>
                ) : null}
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
              <VolumeMunicipioBars
                municipios={count!.porMunicipio}
                total={count?.total || 1}
              />
            ) : null}
            {showCountBreakdown ? <VolumeBreakdown count={count} /> : null}
            </div>
          </GlassCard>
        </aside>
        ) : null}
      </div>
    </AppShell>
  );
}
