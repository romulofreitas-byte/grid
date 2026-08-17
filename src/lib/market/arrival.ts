import { enrichmentStage } from "@/lib/enrichment/fresh";
import type { EnrichmentStage, LeadEnrichment } from "@/lib/types";

export type ArrivalStatus = "pending" | "live" | "done";

export type ArrivalStep = {
  id: EnrichmentStage | "queue";
  label: string;
  status: ArrivalStatus;
};

const STAGE_RANK: Record<EnrichmentStage, number> = {
  domain: 1,
  home: 2,
  site: 3,
  complete: 4,
};

function rank(stage: EnrichmentStage | null): number {
  if (!stage) return 0;
  return STAGE_RANK[stage];
}

function domainLabel(enrichment: LeadEnrichment | null): string {
  if (!enrichment || rank(enrichmentStage(enrichment)) < 1) {
    return "buscando site";
  }
  if (enrichment.domain_status === "nao_encontrado") return "sem site na busca";
  if (enrichment.domain) return `site: ${enrichment.domain}`;
  return "domínio encontrado";
}

function homeLabel(enrichment: LeadEnrichment | null): string {
  if (!enrichment || rank(enrichmentStage(enrichment)) < 2) {
    return "lendo o site";
  }
  const bits: string[] = [];
  if (enrichment.whatsapp) bits.push("WhatsApp no site");
  if (enrichment.socials.instagram) bits.push("Instagram");
  if (enrichment.phones.some((p) => p.sources.some((s) => s.startsWith("site")))) {
    bits.push("telefone no site");
  }
  if (bits.length) return bits.join(" · ");
  if (enrichment.domain_status === "confirmado") return "site no ar";
  if (enrichment.domain_status === "nao_encontrado") return "sem páginas pra ler";
  return "home lida";
}

function siteLabel(enrichment: LeadEnrichment | null): string {
  if (!enrichment || rank(enrichmentStage(enrichment)) < 3) {
    return "procurando nomes no site";
  }
  const n = enrichment.people?.length ?? 0;
  if (n > 0) return `${n} ${n === 1 ? "nome" : "nomes"} no site`;
  return "nenhum nome no site";
}

function completeLabel(enrichment: LeadEnrichment | null): string {
  if (!enrichment || enrichmentStage(enrichment) !== "complete") {
    return "cruzando telefone e mapa";
  }
  if (enrichment.osm?.matched) return "telefone cruzado com o mapa";
  return "cruzamento concluído";
}

function statusFor(
  stepRank: number,
  current: number,
  qualifying: boolean,
): ArrivalStatus {
  if (current >= stepRank) return "done";
  if (qualifying && current === stepRank - 1) return "live";
  if (qualifying && current < stepRank) return "pending";
  return "pending";
}

export function liveArrivalLine(
  enrichment: LeadEnrichment | null,
  qualifying: boolean,
): string | null {
  const complete = enrichment ? enrichmentStage(enrichment) === "complete" : false;
  if (!qualifying && complete) return null;
  const steps = buildArrivalTrail(enrichment, qualifying);
  const live = [...steps].reverse().find((step) => step.status === "live");
  return live?.label ?? null;
}

export function buildArrivalTrail(
  enrichment: LeadEnrichment | null,
  qualifying: boolean,
): ArrivalStep[] {
  const current = enrichment ? rank(enrichmentStage(enrichment)) : 0;
  const queued = qualifying && !enrichment;
  return [
    {
      id: "queue",
      label: queued ? "qualificação na fila" : "qualificação iniciada",
      status: queued ? "live" : current > 0 || !qualifying ? "done" : "pending",
    },
    {
      id: "domain",
      label: domainLabel(enrichment),
      status: statusFor(1, current, qualifying),
    },
    {
      id: "home",
      label: homeLabel(enrichment),
      status: statusFor(2, current, qualifying),
    },
    {
      id: "site",
      label: siteLabel(enrichment),
      status: statusFor(3, current, qualifying),
    },
    {
      id: "complete",
      label: completeLabel(enrichment),
      status: statusFor(4, current, qualifying),
    },
  ];
}
