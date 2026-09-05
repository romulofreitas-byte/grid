import type { CrmDealSource } from "@/lib/crm/types";

export type CrmCompanyAttachMode = "hidden" | "cnpj" | "qualify" | "search";

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
