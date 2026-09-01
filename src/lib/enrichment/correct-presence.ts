import { isDirectoryUrl } from "@/lib/enrichment/directory-blocklist";
import { normalizeSocialUrl } from "@/lib/enrichment/extract";
import { midiaPagaLabel } from "@/lib/enrichment/tech";
import { parseInstagramHandle } from "@/lib/instagram";
import { normalizePhoneBR } from "@/lib/phone";
import { computeDorDigital } from "@/lib/scoring";
import type { LeadEnrichment, ScoreProfile } from "@/lib/types";

export type PresenceCorrection = {
  domain?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  youtube?: string | null;
  whatsapp?: string | null;
  gmb?: string | null;
};

export type PresenceCorrectionResult =
  | { kind: "recrawl"; domain: string }
  | { kind: "patch"; row: LeadEnrichment };

export class PresenceCorrectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresenceCorrectionError";
  }
}

const SOCIAL_HOST = {
  facebook: /(?:^|\.)(?:facebook|fb)\.com$/i,
  linkedin: /(?:^|\.)linkedin\.com$/i,
  youtube: /(?:^|\.)(?:youtube\.com|youtu\.be)$/i,
} as const;

const WA_HREF =
  /(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?(?:[^#]*&)?phone=|web\.whatsapp\.com\/send\/?\?(?:[^#]*&)?phone=|whatsapp:\/\/send\/?\?(?:[^#]*&)?phone=)(\+?\d{10,15})/i;

const PRESENCE_KEYS = [
  "domain",
  "instagram",
  "facebook",
  "linkedin",
  "youtube",
  "whatsapp",
  "gmb",
] as const;

export function hasPresenceFields(correction: PresenceCorrection): boolean {
  return PRESENCE_KEYS.some((key) => correction[key] !== undefined);
}

export function normalizeCompanyDomain(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/\//, "")}`;
    const u = new URL(withProto);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host.includes(".") || isDirectoryUrl(host)) return null;
    return host;
  } catch {
    return null;
  }
}

function stamp(
  row: LeadEnrichment,
  key: string,
  collectedAt: string,
): LeadEnrichment["fonte"] {
  return {
    ...row.fonte,
    [key]: { fonte: "human", coletado_em: collectedAt },
  };
}

function dropSocial(
  socials: LeadEnrichment["socials"],
  key: keyof LeadEnrichment["socials"],
): LeadEnrichment["socials"] {
  const next = { ...socials };
  delete next[key];
  return next;
}

function socialUrlFor(
  network: keyof typeof SOCIAL_HOST,
  raw: string,
  label: string,
): string {
  const normalized = normalizeSocialUrl(raw);
  if (!normalized) {
    throw new PresenceCorrectionError(`${label} inválido.`);
  }
  try {
    const host = new URL(normalized).hostname.replace(/^www\./i, "");
    if (!SOCIAL_HOST[network].test(host)) {
      throw new PresenceCorrectionError(`${label} inválido.`);
    }
  } catch (err) {
    if (err instanceof PresenceCorrectionError) throw err;
    throw new PresenceCorrectionError(`${label} inválido.`);
  }
  return normalized;
}

function instagramUrl(raw: string): string {
  const handle = parseInstagramHandle(raw);
  if (!handle) {
    throw new PresenceCorrectionError("Instagram inválido.");
  }
  return `https://instagram.com/${handle}`;
}

function whatsappDigits(raw: string): string {
  const fromHref = raw.match(WA_HREF)?.[1];
  const phone = normalizePhoneBR(fromHref ?? raw);
  if (!phone || phone.tipo !== "movel") {
    throw new PresenceCorrectionError("WhatsApp inválido.");
  }
  return phone.e164.replace("+", "");
}

function gmbUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new PresenceCorrectionError("URL do Google Meu Negócio inválida.");
  }
  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/\//, "")}`;
    const u = new URL(withProto);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.toLowerCase();
    const ok =
      host === "business.google.com" ||
      host.endsWith(".business.google.com") ||
      host === "maps.google.com" ||
      host === "maps.app.goo.gl" ||
      host === "goo.gl" ||
      (host === "google.com" && path.startsWith("/maps")) ||
      (host.endsWith(".google.com") && path.startsWith("/maps"));
    if (!ok) {
      throw new PresenceCorrectionError("URL do Google Meu Negócio inválida.");
    }
    return u.toString();
  } catch (err) {
    if (err instanceof PresenceCorrectionError) throw err;
    throw new PresenceCorrectionError("URL do Google Meu Negócio inválida.");
  }
}

function finishPatch(
  row: LeadEnrichment,
  scoreProfile: ScoreProfile,
): LeadEnrichment {
  const next = {
    ...row,
    midiaPaga: midiaPagaLabel(row.tech, row.domain_status === "confirmado"),
  };
  next.dor_digital = computeDorDigital(scoreProfile, next);
  return next;
}

function clearDomain(row: LeadEnrichment, collectedAt: string): LeadEnrichment {
  const discarded = new Set(row.discarded_domains ?? []);
  if (row.domain) discarded.add(row.domain.replace(/^www\./i, "").toLowerCase());
  return {
    ...row,
    domain: null,
    domain_status: "nao_encontrado",
    http_status: null,
    discarded_domains: [...discarded],
    fonte: stamp(row, "domain", collectedAt),
  };
}

export function applyPresenceCorrection(
  row: LeadEnrichment,
  correction: PresenceCorrection,
  options: {
    scoreProfile?: ScoreProfile;
    companyName?: string;
    now?: Date;
  } = {},
): PresenceCorrectionResult {
  if (!hasPresenceFields(correction)) {
    throw new PresenceCorrectionError("Informe um campo para corrigir.");
  }

  const scoreProfile = options.scoreProfile ?? "b2c_local";
  const collectedAt = (options.now ?? new Date()).toISOString();

  if (correction.domain !== undefined) {
    if (correction.domain == null || correction.domain.trim() === "") {
      return {
        kind: "patch",
        row: finishPatch(clearDomain(row, collectedAt), scoreProfile),
      };
    }
    const host = normalizeCompanyDomain(correction.domain);
    if (!host) {
      throw new PresenceCorrectionError("Domínio inválido.");
    }
    return { kind: "recrawl", domain: host };
  }

  const next: LeadEnrichment = { ...row, socials: { ...row.socials } };

  if (correction.instagram !== undefined) {
    if (correction.instagram == null || correction.instagram.trim() === "") {
      next.socials = dropSocial(next.socials, "instagram");
    } else {
      next.socials.instagram = instagramUrl(correction.instagram);
    }
    next.fonte = stamp(next, "instagram", collectedAt);
  }

  if (correction.facebook !== undefined) {
    if (correction.facebook == null || correction.facebook.trim() === "") {
      next.socials = dropSocial(next.socials, "facebook");
    } else {
      next.socials.facebook = socialUrlFor(
        "facebook",
        correction.facebook,
        "Facebook",
      );
    }
    next.fonte = stamp(next, "facebook", collectedAt);
  }

  if (correction.linkedin !== undefined) {
    if (correction.linkedin == null || correction.linkedin.trim() === "") {
      next.socials = dropSocial(next.socials, "linkedin");
    } else {
      next.socials.linkedin = socialUrlFor(
        "linkedin",
        correction.linkedin,
        "LinkedIn",
      );
    }
    next.fonte = stamp(next, "linkedin", collectedAt);
  }

  if (correction.youtube !== undefined) {
    if (correction.youtube == null || correction.youtube.trim() === "") {
      next.socials = dropSocial(next.socials, "youtube");
    } else {
      next.socials.youtube = socialUrlFor(
        "youtube",
        correction.youtube,
        "YouTube",
      );
    }
    next.fonte = stamp(next, "youtube", collectedAt);
  }

  if (correction.whatsapp !== undefined) {
    next.whatsapp =
      correction.whatsapp == null || correction.whatsapp.trim() === ""
        ? null
        : whatsappDigits(correction.whatsapp);
    next.fonte = stamp(next, "whatsapp", collectedAt);
  }

  if (correction.gmb !== undefined) {
    if (correction.gmb == null || correction.gmb.trim() === "") {
      next.gmb = { name: "", url: "", matched: false };
    } else {
      const url = gmbUrl(correction.gmb);
      next.gmb = {
        name: options.companyName?.trim() || row.gmb?.name || "Google Meu Negócio",
        url,
        matched: true,
      };
    }
    next.fonte = stamp(next, "gmb", collectedAt);
  }

  return { kind: "patch", row: finishPatch(next, scoreProfile) };
}
