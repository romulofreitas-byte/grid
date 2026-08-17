import type { CompanySearchHit } from "@/lib/types";

export const RECENT_COMPANIES_KEY = "grid_recent_companies";
export const RECENT_COMPANIES_MAX = 5;

export type RecentCompany = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  municipio: string;
  uf: string;
  viewedAt: number;
};

export type RecentStorage = Pick<Storage, "getItem" | "setItem">;

function getLocalStorage(): RecentStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseRecent(raw: string): RecentCompany[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const items: RecentCompany[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const cnpj = asText(rec.cnpj).replace(/\D/g, "");
      if (cnpj.length !== 14 || seen.has(cnpj)) continue;
      seen.add(cnpj);
      items.push({
        cnpj,
        razaoSocial: asText(rec.razaoSocial) || "NÃO ENCONTRADO",
        nomeFantasia:
          rec.nomeFantasia == null || rec.nomeFantasia === ""
            ? null
            : asText(rec.nomeFantasia),
        municipio: asText(rec.municipio) || "NÃO ENCONTRADO",
        uf: asText(rec.uf).slice(0, 2).toUpperCase(),
        viewedAt: typeof rec.viewedAt === "number" ? rec.viewedAt : 0,
      });
      if (items.length >= RECENT_COMPANIES_MAX) break;
    }
    return items;
  } catch {
    return [];
  }
}

export function readRecentCompanies(storage: RecentStorage | null = getLocalStorage()): RecentCompany[] {
  if (!storage) return [];
  const raw = storage.getItem(RECENT_COMPANIES_KEY);
  if (!raw) return [];
  return parseRecent(raw);
}

export function rememberRecentCompany(
  hit: Pick<CompanySearchHit, "cnpj" | "razaoSocial" | "nomeFantasia" | "municipio" | "uf">,
  storage: RecentStorage | null = getLocalStorage(),
  now = Date.now(),
): RecentCompany[] {
  const cnpj = hit.cnpj.replace(/\D/g, "");
  if (cnpj.length !== 14 || !storage) {
    return readRecentCompanies(storage);
  }
  const next: RecentCompany[] = [
    {
      cnpj,
      razaoSocial: hit.razaoSocial || "NÃO ENCONTRADO",
      nomeFantasia: hit.nomeFantasia,
      municipio: hit.municipio || "NÃO ENCONTRADO",
      uf: hit.uf,
      viewedAt: now,
    },
    ...readRecentCompanies(storage).filter((item) => item.cnpj !== cnpj),
  ].slice(0, RECENT_COMPANIES_MAX);
  storage.setItem(RECENT_COMPANIES_KEY, JSON.stringify(next));
  return next;
}
