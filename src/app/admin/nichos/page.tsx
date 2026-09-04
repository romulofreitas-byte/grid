"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SectionTitle } from "@/components/SectionTitle";
import { BACK } from "@/lib/back";
import { cn } from "@/lib/utils";

type NicheTree = {
  id: string;
  nome: string;
  grupo: string;
  segments: Array<{ id: string; nome: string }>;
};

type Row = {
  codigo: string;
  descricao: string;
  incluido: boolean;
  count: number;
};

export default function AdminNichosPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [addDraft, setAddDraft] = useState("");
  const qc = useQueryClient();

  const treeQuery = useQuery({
    queryKey: ["admin-tree"],
    queryFn: async () => {
      const res = await fetch("/api/niches/presets?tree=1");
      return (await res.json()) as NicheTree[];
    },
  });

  const countsQuery = useQuery({
    queryKey: ["admin-counts"],
    queryFn: async () => {
      const res = await fetch("/api/niches/counts");
      return (await res.json()) as Record<string, number>;
    },
  });

  const metaQuery = useQuery({
    queryKey: ["grid-meta"],
    queryFn: async () => {
      const res = await fetch("/api/meta");
      return (await res.json()) as { demoMode: boolean; dataSource: string };
    },
    staleTime: 60_000,
  });
  const countSuffix = metaQuery.data?.demoMode ? " (mock)" : "";

  const detailQuery = useQuery({
    queryKey: ["admin-preset", selected],
    queryFn: async () => {
      const res = await fetch(`/api/niches/presets/${selected}`);
      return res.json() as Promise<{
        preset: {
          nome: string;
          curado: boolean;
          keywords: string[];
          parent_id: string | null;
        };
        rows: Row[];
      }>;
    },
    enabled: !!selected,
  });

  useEffect(() => {
    if (detailQuery.data?.rows) setRows(detailQuery.data.rows);
  }, [detailQuery.data]);

  const cnaeSearch = useQuery({
    queryKey: ["admin-cnae-add", addDraft],
    queryFn: async () => {
      const res = await fetch(
        `/api/ref/cnaes?q=${encodeURIComponent(addDraft.trim())}`,
      );
      if (!res.ok) return [] as Array<{ codigo: string; descricao: string }>;
      return (await res.json()) as Array<{ codigo: string; descricao: string }>;
    },
    enabled: addDraft.trim().length >= 2,
  });

  function addCnae(codigo: string, descricao: string) {
    setRows((prev) => {
      if (prev.some((r) => r.codigo === codigo)) {
        return prev.map((r) =>
          r.codigo === codigo ? { ...r, incluido: true } : r,
        );
      }
      return [{ codigo, descricao, incluido: true, count: 0 }, ...prev];
    });
    setAddDraft("");
  }

  const save = useMutation({
    mutationFn: async () => {
      await fetch(`/api/niches/presets/${selected}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rows.map((r) => ({ cnae: r.codigo, incluido: r.incluido })),
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-preset", selected] });
      qc.invalidateQueries({ queryKey: ["admin-tree"] });
      qc.invalidateQueries({ queryKey: ["admin-counts"] });
      qc.invalidateQueries({ queryKey: ["niche-tree"] });
      qc.invalidateQueries({ queryKey: ["niche-counts"] });
    },
  });

  return (
    <AppShell title="Nichos" back={BACK.painel}>
      <SectionTitle>Curadoria de segmentos</SectionTitle>
      <Hint className="mt-2 max-w-2xl text-sm">
        Escolha o segmento e marque as atividades (CNAE) que entram na busca.
        Você também pode incluir CNAEs por código mesmo fora das keywords.
      </Hint>

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
        <GlassCard className="max-h-[70vh] space-y-4 overflow-auto p-3">
          {(treeQuery.data ?? []).map((n) => (
            <div key={n.id}>
              <p className="px-2 text-xs font-bold uppercase tracking-wide text-podium-muted">
                {n.nome}
              </p>
              <div className="mt-1 space-y-1">
                {n.segments.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelected(s.id)}
                    className={cn(
                      "w-full rounded-xl px-3 py-2 text-left text-sm",
                      selected === s.id
                        ? "bg-podium-yellow/15 text-podium-yellow"
                        : "text-podium-gray hover:bg-white/5",
                    )}
                  >
                    {s.nome}
                    <span className="mt-0.5 block text-[11px] text-podium-muted">
                      {countsQuery.data?.[s.id] != null
                        ? `${countsQuery.data[s.id].toLocaleString("pt-BR")} empresas${countSuffix}`
                        : countsQuery.isFetching
                          ? "…"
                          : "—"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </GlassCard>

        <GlassCard className="p-5">
          {!selected ? (
            <p className="text-sm text-podium-muted">
              Selecione um segmento à esquerda.
            </p>
          ) : detailQuery.isLoading ? (
            <div className="h-40 animate-pulse rounded-xl bg-white/5" />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-extrabold">
                    {detailQuery.data?.preset.nome}
                  </h3>
                  <p className="text-xs text-podium-muted">
                    {detailQuery.data?.preset.curado
                      ? "Curado"
                      : "Ainda não curado"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setRows((prev) =>
                        prev.map((x) => ({ ...x, incluido: true })),
                      )
                    }
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-podium-gray hover:bg-white/5"
                  >
                    Marcar todos
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRows((prev) =>
                        prev.map((x) => ({ ...x, incluido: false })),
                      )
                    }
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-podium-gray hover:bg-white/5"
                  >
                    Desmarcar todos
                  </button>
                  <button
                    type="button"
                    onClick={() => save.mutate()}
                    className="rounded-xl bg-podium-yellow px-4 py-2 text-sm font-bold text-podium-navy"
                  >
                    Salvar curadoria
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs font-semibold text-podium-muted">
                  Incluir CNAE por código ou descrição
                </label>
                <input
                  value={addDraft}
                  onChange={(e) => setAddDraft(e.target.value)}
                  placeholder="Ex.: 1121600 ou águas envasadas"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2 text-sm outline-none focus:border-podium-yellow/40"
                />
                {addDraft.trim().length >= 2 && (
                  <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-xl border border-white/10 p-2">
                    {(cnaeSearch.data ?? []).slice(0, 12).map((c) => (
                      <button
                        key={c.codigo}
                        type="button"
                        onClick={() => addCnae(c.codigo, c.descricao)}
                        className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5"
                      >
                        <span className="font-mono text-xs text-podium-muted">
                          {c.codigo}
                        </span>{" "}
                        {c.descricao}
                      </button>
                    ))}
                    {cnaeSearch.isFetching ? (
                      <p className="px-2 text-xs text-podium-muted">Buscando…</p>
                    ) : null}
                    {!cnaeSearch.isFetching &&
                    (cnaeSearch.data?.length ?? 0) === 0 ? (
                      <p className="px-2 text-xs text-podium-muted">
                        Nenhum CNAE encontrado.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {rows.map((r, idx) => (
                  <label
                    key={r.codigo}
                    className="flex items-start gap-3 rounded-xl border border-white/5 px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={r.incluido}
                      onChange={(e) => {
                        setRows((prev) =>
                          prev.map((x, i) =>
                            i === idx
                              ? { ...x, incluido: e.target.checked }
                              : x,
                          ),
                        );
                      }}
                      className="mt-1 accent-podium-yellow"
                    />
                    <span className="text-sm">
                      <span className="font-mono text-xs text-podium-muted">
                        {r.codigo}
                      </span>{" "}
                      {r.descricao}
                      <span className="mt-0.5 block text-xs text-podium-muted">
                        {r.count} empresas{countSuffix}
                      </span>
                    </span>
                  </label>
                ))}
                {rows.length === 0 && (
                  <p className="text-sm text-podium-muted">
                    Nenhuma atividade encontrada para este segmento.
                  </p>
                )}
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </AppShell>
  );
}
