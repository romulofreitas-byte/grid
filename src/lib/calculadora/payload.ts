import type { CrmRateSuggestions } from "@/lib/calculadora/crm-rates";
import type { PilotMeta } from "@/lib/calculadora/meta";

export type MetasPayload = {
  metas: PilotMeta[];
  activeMetaId: string | null;
  metaLigacoesDia: number;
  suggestions: CrmRateSuggestions;
};
