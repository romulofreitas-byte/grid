import type { CrmDealSource } from "@/lib/crm/types";

export type CrmCompanyAttachMode = "hidden" | "cnpj" | "qualify" | "search";

export type CrmDealAttachSurface = "banner" | "aside";

/** How many Grid hits the CRM attach strip lists. */
export const GRID_ATTACH_HIT_LIMIT = 5;

export function crmDealAttachSurface(input: {
  cnpj: string | null;
  source?: CrmDealSource;
  audited: boolean;
  briefingReady: boolean;
}): CrmDealAttachSurface | null {
  const mode = crmCompanyAttachMode(input);
  if (mode === "search" || mode === "qualify") return "banner";
  if (input.cnpj && isCrmEnrichableSource(input.source) && !input.audited) {
    return "banner";
  }
  if (mode === "cnpj") return "aside";
  return null;
}

export function isCrmEnrichableSource(
  source: CrmDealSource | undefined,
): boolean {
  return source === "import" || source === "inbound";
}

export function crmCompanyAttachMode(input: {
  cnpj: string | null;
  source?: CrmDealSource;
  audited: boolean;
  briefingReady: boolean;
}): CrmCompanyAttachMode {
  if (!input.cnpj) {
    if (
      isCrmEnrichableSource(input.source) ||
      input.source === "crm_add" ||
      !input.source
    ) {
      return "search";
    }
    return "hidden";
  }
  if (!isCrmEnrichableSource(input.source)) return "cnpj";
  if (!input.briefingReady || input.audited) return "cnpj";
  return "qualify";
}
