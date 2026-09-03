import { getRepo } from "@/lib/data";
import { needsDiscoveryRetry } from "@/lib/enrichment/discovery";

/** Re-run site discovery for billed misses after the ranking rules change. No extra debit. */
export async function enqueueDiscoveryRetries(input: {
  cnpjs: string[];
  userId: string;
  searchId: string | null;
  priority?: boolean;
}): Promise<number> {
  const unique = [...new Set(input.cnpjs.map((c) => c.replace(/\D/g, "")))].filter(
    Boolean,
  );
  if (!unique.length) return 0;
  const repo = getRepo();
  const pending: string[] = [];
  for (const cnpj of unique) {
    if (await repo.hasActiveEnrichmentJob(cnpj)) continue;
    const row = await repo.getEnrichment(cnpj);
    if (!needsDiscoveryRetry(row)) continue;
    pending.push(cnpj.padStart(14, "0"));
  }
  if (!pending.length) return 0;
  const result = await repo.enqueueEnrichment({
    cnpjs: pending,
    userId: input.userId,
    searchId: input.searchId,
    force: true,
    priority: input.priority === true,
    payload: { force: true },
  });
  return result.queued;
}
