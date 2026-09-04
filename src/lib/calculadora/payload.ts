import type { CrmRateSuggestions } from "@/lib/calculadora/crm-rates";
import type { FunnelPlan } from "@/lib/calculadora/funnel";

export type CalculadoraPayload = {
  plan: FunnelPlan;
  metaLigacoesDia: number;
  suggestions: CrmRateSuggestions;
};
