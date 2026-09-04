export type ExplodedSearch = {
  nicheId: string | null;
  nicheNome: string | null;
  segmentId: string | null;
  segmentNome: string | null;
  uf: string | null;
  intentOnly: boolean;
};

export type OpsNicheCount = {
  id: string;
  nome: string;
  count: number;
};

export type OpsUfCount = {
  uf: string;
  count: number;
};

export type OpsNicheUfCell = {
  nicheId: string;
  nicheNome: string;
  uf: string;
  count: number;
};

export function parentNicheOf(row: ExplodedSearch): {
  id: string;
  nome: string;
} | null {
  if (!row.nicheId && !row.segmentId) return null;
  const id = row.nicheId ?? row.segmentId;
  if (!id) return null;
  const nome = row.nicheNome ?? row.segmentNome ?? id;
  return { id, nome };
}

export function rollupNiches(rows: ExplodedSearch[]): OpsNicheCount[] {
  const map = new Map<string, OpsNicheCount>();
  for (const row of rows) {
    const niche = parentNicheOf(row);
    if (!niche) continue;
    const current = map.get(niche.id) ?? { id: niche.id, nome: niche.nome, count: 0 };
    current.count += 1;
    map.set(niche.id, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.nome.localeCompare(b.nome));
}

export function rollupSegments(rows: ExplodedSearch[]): OpsNicheCount[] {
  const map = new Map<string, OpsNicheCount>();
  for (const row of rows) {
    if (!row.segmentId) continue;
    const nome = row.segmentNome ?? row.segmentId;
    const current = map.get(row.segmentId) ?? {
      id: row.segmentId,
      nome,
      count: 0,
    };
    current.count += 1;
    map.set(row.segmentId, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.nome.localeCompare(b.nome));
}

export function rollupUfs(rows: ExplodedSearch[]): OpsUfCount[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.uf) continue;
    map.set(row.uf, (map.get(row.uf) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([uf, count]) => ({ uf, count }))
    .sort((a, b) => b.count - a.count || a.uf.localeCompare(b.uf));
}

export function rollupNicheUf(rows: ExplodedSearch[]): OpsNicheUfCell[] {
  const map = new Map<string, OpsNicheUfCell>();
  for (const row of rows) {
    const niche = parentNicheOf(row);
    if (!niche || !row.uf) continue;
    const key = `${niche.id}|${row.uf}`;
    const current = map.get(key) ?? {
      nicheId: niche.id,
      nicheNome: niche.nome,
      uf: row.uf,
      count: 0,
    };
    current.count += 1;
    map.set(key, current);
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.nicheNome.localeCompare(b.nicheNome) || a.uf.localeCompare(b.uf),
  );
}

export function countIntentOnly(rows: ExplodedSearch[]): number {
  return rows.filter((row) => row.intentOnly).length;
}
