import { COPY } from "@/lib/copy";
import { filterQualifiedCnpjs } from "@/lib/billing/service";
import { getRepo } from "@/lib/data";
import type { LeadDossier } from "@/lib/types";

export const EXPORT_NEEDS_QUALIFY = COPY.exportNeedsQualify;
export const EXPORT_PDF_LIMIT = 50;
export const EXPORT_LIST_LIMIT = 1000;

export function exportLimitForFormat(
  format: string | null | undefined,
): number {
  return format === "pdf" ? EXPORT_PDF_LIMIT : EXPORT_LIST_LIMIT;
}

export function padCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "").padStart(14, "0");
}

export function cnpjsFromJobPayload(
  payload: Record<string, unknown> | null,
): string[] | null {
  const raw = payload?.cnpjs;
  if (!Array.isArray(raw)) return null;
  return raw
    .filter((c): c is string => typeof c === "string")
    .map(padCnpj);
}

export async function qualifiedCnpjsForExport(
  profileId: string,
  searchId: string,
  limit: number,
): Promise<string[]> {
  const all = (await getRepo().listExportCnpjs(searchId))
    .map(padCnpj)
    .slice(0, limit);
  if (all.length === 0) return [];
  const allowed = new Set(await filterQualifiedCnpjs(profileId, all));
  return all.filter((cnpj) => allowed.has(cnpj));
}

export async function qualifiedLeadsForExport(
  profileId: string,
  searchId: string,
  limit: number,
): Promise<LeadDossier[]> {
  const all = (await getRepo().getAllLeadsForExport(searchId)).slice(0, limit);
  const allowed = new Set(
    await filterQualifiedCnpjs(
      profileId,
      all.map((lead) => lead.establishment.cnpj),
    ),
  );
  return all.filter((lead) => allowed.has(padCnpj(lead.establishment.cnpj)));
}
