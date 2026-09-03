import { filterQualifiedCnpjs } from "@/lib/billing/service";
import { getRepo } from "@/lib/data";
import type { LeadDossier } from "@/lib/types";

export const EXPORT_NEEDS_QUALIFY =
  "Qualifique pelo menos uma empresa para exportar. No CRM do GRID isso é incluso.";

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
