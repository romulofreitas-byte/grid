import {
  companyNameMatchesFields,
  companyNameTokens,
} from "@/lib/data/company-search";
import type { CompanySearchHit } from "@/lib/types";

const MATCH_CONCURRENCY = 5;

export function namesAlign(query: string, hit: CompanySearchHit): boolean {
  return companyNameMatchesFields(query, hit.razaoSocial, hit.nomeFantasia);
}

export function pickUniqueCompanyHit(
  query: string,
  hits: CompanySearchHit[],
): CompanySearchHit | null {
  const q = query.trim();
  if (!q || hits.length === 0) return null;
  const foldedQuery = companyNameTokens(q).join(" ");
  const exact = hits.filter((hit) => {
    const razao = companyNameTokens(hit.razaoSocial).join(" ");
    const fantasia = companyNameTokens(hit.nomeFantasia ?? "").join(" ");
    return razao === foldedQuery || (Boolean(fantasia) && fantasia === foldedQuery);
  });
  if (exact.length === 1) return exact[0]!;
  if (hits.length === 1 && namesAlign(q, hits[0]!)) return hits[0]!;
  return null;
}

export async function mapPool<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency = MATCH_CONCURRENCY,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      out[index] = await worker(items[index]!, index);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => run()));
  return out;
}
