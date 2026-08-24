import type { MarketPack } from "@/lib/market/packs";
import type { DigitalSignalId, LeadEnrichment } from "@/lib/types";

export type ContextRule = {
  id: DigitalSignalId;
  when: (e: LeadEnrichment) => boolean;
  phrase: (e: LeadEnrichment) => string;
  fonte: (e: LeadEnrichment) => string;
  priority: number;
};

export const PONTE_CHIP: Record<DigitalSignalId, string> = {
  "sem-site": "Sem site",
  "site-fora": "Site fora",
  "sem-mensuracao": "Sem medição",
  "copyright-antigo": "Site parado",
  "sem-instagram": "Sem Instagram",
  "sem-whatsapp": "Sem WhatsApp",
  "midia-paga": "Sinal de anúncio",
};

export const GOLDEN_MINUTE_PLACEHOLDER =
  "Qualifique esta empresa para cruzar o site com a Receita.";

export const CONTEXT_RULES: ContextRule[] = [
  {
    id: "sem-site",
    priority: 10,
    when: (e) => e.domain_status === "nao_encontrado",
    phrase: () => "não encontrei um site de vocês",
    fonte: () => "busca de domínio",
  },
  {
    id: "site-fora",
    priority: 9,
    when: (e) =>
      e.domain_status !== "nao_encontrado" &&
      e.http_status != null &&
      e.http_status >= 500,
    phrase: () => "o site de vocês não abriu agora",
    fonte: (e) => `HTTP ${e.http_status}`,
  },
  {
    id: "sem-mensuracao",
    priority: 8,
    when: (e) =>
      e.domain_status === "confirmado" && !e.tech.metaPixel && !e.tech.gtm,
    phrase: () =>
      "o site de vocês está no ar, mas não tem nenhuma ferramenta de mensuração instalada",
    fonte: () => "HTML do site",
  },
  {
    id: "copyright-antigo",
    priority: 7,
    when: (e) =>
      e.domain_status === "confirmado" &&
      typeof e.freshness.copyrightYear === "number" &&
      e.freshness.copyrightYear <= new Date().getFullYear() - 2,
    phrase: (e) => `vi que o rodapé do site ainda está com ${e.freshness.copyrightYear}`,
    fonte: () => "rodapé do site",
  },
  {
    id: "sem-instagram",
    priority: 6,
    when: (e) => e.domain_status === "confirmado" && !e.socials.instagram,
    phrase: () => "vocês não têm o Instagram linkado no site",
    fonte: () => "links do site",
  },
  {
    id: "sem-whatsapp",
    priority: 5,
    when: (e) => e.domain_status === "confirmado" && !e.whatsapp,
    phrase: () => "não achei um canal de WhatsApp no site de vocês",
    fonte: () => "HTML do site",
  },
  {
    id: "midia-paga",
    priority: 4,
    when: (e) =>
      e.domain_status === "confirmado" &&
      (e.tech.metaPixel || e.tech.googleAds),
    phrase: () =>
      "vi um sinal de anúncio no site de vocês (pixel ou tag) — não prova verba ativa",
    fonte: () => "pixel / tag AW- no HTML",
  },
];

export function buildGoldenMinute(
  enrichment: LeadEnrichment | null,
  pack?: MarketPack | null,
): {
  contexto: string;
  facts: Array<{ phrase: string; fonte: string; id: DigitalSignalId }>;
  insufficient: boolean;
} {
  if (!enrichment) {
    return {
      contexto: GOLDEN_MINUTE_PLACEHOLDER,
      facts: [],
      insufficient: true,
    };
  }

  const facts = CONTEXT_RULES.filter((r) => r.when(enrichment))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)
    .map((r) => ({
      id: r.id,
      phrase: pack?.pontePorSinal[r.id] || r.phrase(enrichment),
      fonte: r.fonte(enrichment),
    }));

  if (facts.length < 2) {
    return {
      contexto: GOLDEN_MINUTE_PLACEHOLDER,
      facts,
      insufficient: true,
    };
  }

  return {
    contexto: facts.map((f) => f.phrase).join("; "),
    facts,
    insufficient: false,
  };
}
