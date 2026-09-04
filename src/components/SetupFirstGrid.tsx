"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, Search } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChoiceTile } from "@/components/ui/ChoiceTile";
import { COPY } from "@/lib/copy";
import { filterMunicipios, municipioLetters } from "@/lib/municipios";
import { normalizeText } from "@/lib/niches";
import { presetMatchesQuery, rankPresetMatch } from "@/lib/segment-aliases";
import { runSearchJob } from "@/lib/search-run-client";
import { DEFAULT_FILTERS, type Search, type SearchFilters } from "@/lib/types";
import { BRAZIL_UF_LIST, isBrazilUf } from "@/lib/ufs";
import { cn } from "@/lib/utils";

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

type Municipio = { id: number; nome: string; uf: string };

const CITY_ALIASES: Record<string, string> = {
  bh: "Belo Horizonte",
  sp: "São Paulo",
  rj: "Rio de Janeiro",
};

function expandCityHint(raw: string): string {
  const alias = CITY_ALIASES[normalizeText(raw)];
  return alias ?? raw.trim();
}

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

export type FirstGridNiche = {
  segmentId: string;
  segmentNome: string;
  parentNome: string;
};

export function SetupFirstGrid({
  cidadeUsuario,
  onBack,
  onReady,
}: {
  cidadeUsuario: string;
  onBack: () => void;
  onReady: (search: Search, niche: FirstGridNiche) => Promise<void>;
}) {
  const [filters, setFilters] = useState<SearchFilters>({ ...DEFAULT_FILTERS });
  const [openNiche, setOpenNiche] = useState<string | null>(null);
  const [segmentQuery, setSegmentQuery] = useState("");
  const [munQuery, setMunQuery] = useState("");
  const [munLetter, setMunLetter] = useState<string | null>(null);
  const [citiesOpen, setCitiesOpen] = useState(false);
  const [queuePosition, setQueuePosition] = useState(0);
  const [suggested, setSuggested] = useState(false);

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
      if (!res.ok) throw new Error("municipios");
      return (await res.json()) as Municipio[];
    },
    enabled: filters.ufs.length > 0,
  });

  useEffect(() => {
    if (suggested) return;
    const raw = cidadeUsuario.trim();
    if (!raw) {
      setSuggested(true);
      return;
    }
    if (isBrazilUf(raw)) {
      setFilters((f) => ({ ...f, ufs: [raw.trim().toUpperCase()] }));
      setSuggested(true);
      return;
    }
    let cancelled = false;
    const q = expandCityHint(raw);
    void (async () => {
      try {
        const res = await fetch(
          `/api/ref/municipios?q=${encodeURIComponent(q)}`,
        );
        if (!res.ok || cancelled) return;
        const rows = (await res.json()) as Municipio[];
        if (cancelled || !Array.isArray(rows) || rows.length === 0) return;
        const nq = normalizeText(q);
        const exact = rows.filter((m) => normalizeText(m.nome) === nq);
        const pick = exact[0] ?? (rows.length === 1 ? rows[0] : null);
        if (pick) {
          setFilters((f) => ({
            ...f,
            ufs: [pick.uf],
            municipioIds: [pick.id],
          }));
          setCitiesOpen(true);
        } else if (rows.every((m) => m.uf === rows[0]!.uf)) {
          setFilters((f) => ({ ...f, ufs: [rows[0]!.uf], municipioIds: [] }));
        }
      } catch {
        /* keep UF unselected; the piloto escolhe na grade */
      } finally {
        if (!cancelled) setSuggested(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cidadeUsuario, suggested]);

  useEffect(() => {
    setMunQuery("");
    setMunLetter(null);
  }, [filters.ufs]);

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

  useEffect(() => {
    if (!segmentSearch || filteredNicheTree.length === 0) return;
    setOpenNiche((prev) => {
      if (prev && filteredNicheTree.some((n) => n.id === prev)) return prev;
      return filteredNicheTree[0]?.id ?? null;
    });
  }, [segmentSearch, filteredNicheTree]);

  const selected = useMemo(() => {
    const id = filters.segmentIds[0];
    if (!id) return null;
    for (const n of nicheTree) {
      const seg = n.segments.find((s) => s.id === id);
      if (seg) {
        return {
          segmentId: seg.id,
          segmentNome: seg.nome,
          parentNome: n.nome,
        };
      }
    }
    return null;
  }, [filters.segmentIds, nicheTree]);

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

  function pickSegment(id: string) {
    setFilters((f) => ({
      ...f,
      presetId: null,
      segmentIds: f.segmentIds[0] === id ? [] : [id],
      intentQuery: null,
      cnaes: [],
    }));
  }

  const generate = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error(COPY.setupNeedNiche);
      if (!filters.ufs.length) throw new Error(COPY.setupNeedRegion);
      const search = await runSearchJob({
        nome: `Lista · ${selected.segmentNome}`,
        filters,
        onQueue: setQueuePosition,
      });
      const saveRes = await fetch(`/api/search/${search.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved: true }),
      });
      if (!saveRes.ok) throw new Error("Não foi possível salvar a lista");
      const saved = (await saveRes.json()) as Search;
      await onReady(saved, selected);
      return saved;
    },
  });

  const canGenerate = Boolean(selected) && filters.ufs.length > 0;
  const busy = generate.isPending;

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
            const open =
              openNiche === n.id || (!!segmentSearch && items.length <= 3);
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
                      {selectedCount > 0
                        ? ` · ${selectedCount} selecionado`
                        : ""}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-podium-muted transition",
                      open && "rotate-180",
                    )}
                  />
                </button>
                {open ? (
                  <div className="grid gap-2 border-t border-white/10 p-3 sm:grid-cols-2">
                    {n.segments.map((s) => {
                      const on = filters.segmentIds.includes(s.id);
                      const nameHit =
                        !!segmentSearch &&
                        rankPresetMatch(segmentFields(n, s), segmentQuery) >=
                          70;
                      return (
                        <ChoiceTile
                          key={s.id}
                          density="card"
                          selected={on}
                          onClick={() => pickSegment(s.id)}
                          className={
                            nameHit ? "ring-1 ring-podium-yellow/50" : undefined
                          }
                        >
                          {s.nome}
                        </ChoiceTile>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-5">
      {selected ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => pickSegment(selected.segmentId)}>
            <Badge variant="accent">{selected.segmentNome} ×</Badge>
          </button>
        </div>
      ) : null}

      {treeQuery.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      ) : selected ? null : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-podium-muted" />
            <input
              value={segmentQuery}
              onChange={(e) => setSegmentQuery(e.target.value)}
              placeholder="Buscar nicho (ex.: clínica, marketing, plano de saúde)"
              className="w-full rounded-xl border border-white/10 bg-podium-panel py-3 pl-10 pr-3 text-sm outline-none focus:border-podium-yellow/40"
            />
          </div>
          <NicheGroup title="B2C local" hint={COPY.b2c} items={b2c} />
          <NicheGroup title="B2B" hint={COPY.b2b} items={b2b} />
        </>
      )}

      <GlassCard className="space-y-4 p-5">
        <h3 className="font-semibold">Região — um estado</h3>
        <p className="text-xs text-podium-muted">
          A cidade que você informou pode já vir marcada. Dá para refinar.
        </p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-9">
          {BRAZIL_UF_LIST.map((uf) => {
            const on = filters.ufs[0] === uf;
            return (
              <ChoiceTile
                key={uf}
                density="compact"
                selected={on}
                aria-label={`Estado ${uf}`}
                onClick={() => {
                  if (on) return;
                  setFilters((f) => ({ ...f, ufs: [uf], municipioIds: [] }));
                }}
              >
                {uf}
              </ChoiceTile>
            );
          })}
        </div>
        {filters.ufs.length === 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">{filters.ufs[0]}</Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setFilters((f) => ({ ...f, ufs: [], municipioIds: [] }))
              }
            >
              Limpar estado
            </Button>
          </div>
        ) : null}
        {filters.ufs.length === 1 ? (
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
                    : "Opcional — estado inteiro"}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-podium-muted transition",
                  citiesOpen && "rotate-180",
                )}
              />
            </button>
            {citiesOpen ? (
              <div className="border-t border-white/10 p-3">
                <input
                  value={munQuery}
                  onChange={(e) => setMunQuery(e.target.value)}
                  placeholder="Buscar município…"
                  className="mb-3 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 text-sm outline-none focus:border-podium-yellow/40"
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
                          onClick={() => setMunLetter(on ? null : letter)}
                        >
                          {letter}
                        </ChoiceTile>
                      );
                    })}
                  </div>
                ) : null}
                <div className="grid max-h-56 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">
                  {municipiosShown.map((m) => {
                    const on = filters.municipioIds.includes(m.id);
                    return (
                      <ChoiceTile
                        key={m.id}
                        density="chip"
                        selected={on}
                        className="min-w-0 flex-none"
                        onClick={() =>
                          setFilters((f) => ({
                            ...f,
                            municipioIds: on
                              ? f.municipioIds.filter((id) => id !== m.id)
                              : [...f.municipioIds, m.id],
                          }))
                        }
                      >
                        <span className="truncate">{m.nome}</span>
                      </ChoiceTile>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </GlassCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onBack}
          className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-podium-gray disabled:opacity-40"
        >
          Voltar
        </button>
        <Button
          variant="primary"
          size="lg"
          disabled={!canGenerate || busy}
          onClick={() => generate.mutate()}
        >
          {busy
            ? queuePosition > 1
              ? `Na fila · ${queuePosition} à frente`
              : COPY.filaMontando
            : COPY.setupGenerate}
        </Button>
      </div>
      {generate.error ? (
        <p className="text-center text-xs text-podium-alert">
          {generate.error.message}
        </p>
      ) : null}
    </div>
  );
}
