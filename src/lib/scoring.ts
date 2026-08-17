import { isOwnDomainEmail } from "@/lib/contact-confidence";
import type { ContactSeal, LeadEnrichment, ScoreProfile } from "@/lib/types";

export const GRID_WEIGHTS = {
  b2c_local: {
    fit: {
      cnaeExato: 12,
      porteCompativel: 8,
      capitalNaFaixa: 6,
      idadeMinima: 4,
    },
    contatabilidade: {
      telefoneConfirmado: 15,
      telefoneNaoConfirmado: 5,
      telefoneCompartilhado: -5,
      whatsappEncontrado: 5,
      emailProprio: 5,
      decisorIdentificado: 7,
    },
    dorDigitalMax: 45,
  },
  b2b_industria: {
    fit: {
      cnaeExato: 20,
      porteCompativel: 18,
      capitalNaFaixa: 12,
      idadeMinima: 5,
    },
    contatabilidade: {
      telefoneConfirmado: 15,
      telefoneNaoConfirmado: 5,
      telefoneCompartilhado: -5,
      whatsappEncontrado: 3,
      emailProprio: 5,
      decisorIdentificado: 7,
    },
    dorDigitalMax: 20,
  },
} as const;

export type ScoreInput = {
  profile: ScoreProfile;
  cnaeMatch: boolean;
  porteCompativel: boolean;
  capitalNaFaixa: boolean;
  idadeMinimaOk: boolean;
  phoneSeal: ContactSeal;
  hasWhatsapp: boolean;
  email: string | null;
  hasDecisor: boolean;
  includeDorDigital?: boolean;
  dorDigitalRaw?: number;
};

function phaseMax(profile: ScoreProfile, includeDor: boolean): number {
  const w = GRID_WEIGHTS[profile];
  const fit =
    w.fit.cnaeExato +
    w.fit.porteCompativel +
    w.fit.capitalNaFaixa +
    w.fit.idadeMinima;
  const cont =
    w.contatabilidade.telefoneConfirmado +
    w.contatabilidade.whatsappEncontrado +
    w.contatabilidade.emailProprio +
    w.contatabilidade.decisorIdentificado;
  return fit + cont + (includeDor ? w.dorDigitalMax : 0);
}

export function computeDorDigital(
  profile: ScoreProfile,
  enrichment: LeadEnrichment | null,
): number {
  if (!enrichment) return 0;
  const w = GRID_WEIGHTS[profile];
  let raw = 0;
  if (
    enrichment.domain_status === "nao_encontrado" ||
    (enrichment.http_status != null && enrichment.http_status >= 400)
  ) {
    raw += 12;
  }
  if (
    enrichment.domain_status === "confirmado" &&
    !enrichment.tech.metaPixel &&
    !enrichment.tech.gtm
  ) {
    raw += 10;
  }
  if (
    enrichment.domain_status === "confirmado" &&
    !enrichment.tech.metaPixel &&
    !enrichment.tech.googleAds
  ) {
    raw += 8;
  }
  if (enrichment.domain_status === "confirmado" && !enrichment.socials.instagram) {
    raw += 8;
  }
  if (!enrichment.whatsapp && !enrichment.tech.chat) {
    raw += 7;
  }
  return Math.min(w.dorDigitalMax, raw);
}

export function computeGridScore(input: ScoreInput): number {
  const w = GRID_WEIGHTS[input.profile];
  let raw = 0;

  if (input.cnaeMatch) raw += w.fit.cnaeExato;
  if (input.porteCompativel) raw += w.fit.porteCompativel;
  if (input.capitalNaFaixa) raw += w.fit.capitalNaFaixa;
  if (input.idadeMinimaOk) raw += w.fit.idadeMinima;

  if (input.phoneSeal === "CONFIRMADO" || input.phoneSeal === "ATUALIZADO") {
    raw += w.contatabilidade.telefoneConfirmado;
  } else if (input.phoneSeal === "COMPARTILHADO") {
    raw += w.contatabilidade.telefoneCompartilhado;
  } else if (
    input.phoneSeal === "NAO_CONFIRMADO" ||
    input.phoneSeal === "GRUPO"
  ) {
    raw += w.contatabilidade.telefoneNaoConfirmado;
  }

  if (input.hasWhatsapp) raw += w.contatabilidade.whatsappEncontrado;
  if (isOwnDomainEmail(input.email)) raw += w.contatabilidade.emailProprio;
  if (input.hasDecisor) raw += w.contatabilidade.decisorIdentificado;

  const includeDor = Boolean(input.includeDorDigital);
  if (includeDor) {
    raw += Math.min(w.dorDigitalMax, input.dorDigitalRaw ?? 0);
  }

  raw = Math.max(0, raw);
  const max = phaseMax(input.profile, includeDor);
  const normalized = Math.round((raw / max) * 100);
  return Math.min(100, Math.max(0, normalized));
}

export function scoreBand(score: number): "POLE" | "FRENTE" | "MEIO" | "FUNDO" {
  if (score >= 85) return "POLE";
  if (score >= 70) return "FRENTE";
  if (score >= 50) return "MEIO";
  return "FUNDO";
}
