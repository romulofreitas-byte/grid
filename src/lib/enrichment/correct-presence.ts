import { parseCompanySite } from "@/lib/enrichment/company-site";
import {
  cidFromMapsUrl,
  isMapsUrl,
  mapsCidUrl,
  mapsPlaceNameFromUrl,
} from "@/lib/enrichment/company-name";
import { normalizeSocialUrl } from "@/lib/enrichment/extract";
import { midiaPagaLabel } from "@/lib/enrichment/tech";
import { parseInstagramHandle } from "@/lib/instagram";
import { normalizePhoneBR } from "@/lib/phone";
import { computeDorDigital } from "@/lib/scoring";
import {
  gmbListingIsCandidate,
  type LeadEnrichment,
  type ScoreProfile,
} from "@/lib/types";

export type PresenceCorrection = {
  domain?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  youtube?: string | null;
  whatsapp?: string | null;
  gmb?: string | null;
  maps?: string | null;
  /** Human said the stored Maps candidate is this CNPJ — no URL paste. */
  confirmMaps?: boolean;
  /** Human picked one Instagram candidate URL. */
  confirmInstagram?: string | null;
};

export type PresenceCorrectionResult =
  | {
      kind: "recrawl";
      domain: string;
      homepagePath: string | null;
      row: LeadEnrichment;
    }
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
  "maps",
] as const;

export function hasPresenceFields(correction: PresenceCorrection): boolean {
  return (
    PRESENCE_KEYS.some((key) => correction[key] !== undefined) ||
    correction.confirmMaps === true ||
    correction.confirmInstagram !== undefined
  );
}

function mapsSearchUrl(url: string | null | undefined): boolean {
  return Boolean(url && /\/maps\/search/i.test(url));
}

/** Candidate pin the operator can cravar without pasting a URL. */
export function mapsPinConfirmable(
  row: LeadEnrichment | null | undefined,
): boolean {
  const listing = row?.gmb;
  if (!listing || !gmbListingIsCandidate(listing)) return false;
  if (listing.cid?.trim()) return true;
  const url = listing.url?.trim();
  if (!url || mapsSearchUrl(url) || !isMapsUrl(url)) return false;
  return true;
}

/** Human said this Maps candidate is the company pin. */
export function instagramCandidateConfirmable(
  row: LeadEnrichment | null | undefined,
): boolean {
  return Boolean(row?.presence_candidates?.instagram?.length);
}

function clearInstagramCandidates(
  row: LeadEnrichment,
): LeadEnrichment["presence_candidates"] {
  if (!row.presence_candidates) return null;
  const next = { ...row.presence_candidates };
  delete next.instagram;
  return Object.keys(next).length > 0 ? next : null;
}

export function applyInstagramCandidate(
  row: LeadEnrichment,
  raw: string | null,
  options: { scoreProfile?: ScoreProfile; now?: Date } = {},
): LeadEnrichment {
  const collectedAt = (options.now ?? new Date()).toISOString();
  const candidates = row.presence_candidates?.instagram ?? [];
  const next: LeadEnrichment = {
    ...row,
    socials: { ...row.socials },
    presence_candidates: clearInstagramCandidates(row),
  };
  if (raw == null || raw.trim() === "") {
    next.socials = dropSocial(next.socials, "instagram");
    next.fonte = stamp(next, "instagram", collectedAt);
    return finishPatch(next, options.scoreProfile ?? "b2c_local");
  }
  const url = instagramUrl(raw);
  const handle = parseInstagramHandle(url);
  const allowed = new Set(
    candidates
      .map((candidate) => parseInstagramHandle(candidate.url)?.toLowerCase())
      .filter((value): value is string => Boolean(value)),
  );
  if (candidates.length > 0 && (!handle || !allowed.has(handle.toLowerCase()))) {
    throw new PresenceCorrectionError(
      "Esse perfil não está na lista de candidatos.",
    );
  }
  next.socials.instagram = url;
  next.fonte = stamp(next, "instagram", collectedAt);
  return finishPatch(next, options.scoreProfile ?? "b2c_local");
}

export function applyMapsConfirm(
  row: LeadEnrichment,
  options: { scoreProfile?: ScoreProfile; now?: Date } = {},
): LeadEnrichment {
  if (!mapsPinConfirmable(row) || !row.gmb) {
    throw new PresenceCorrectionError(
      "Não há pin para confirmar. Cole a URL da ficha no Maps.",
    );
  }
  const collectedAt = (options.now ?? new Date()).toISOString();
  const next: LeadEnrichment = {
    ...row,
    gmb: { ...row.gmb, matched: true, status: "matched" },
  };
  const withGmb: LeadEnrichment = {
    ...next,
    fonte: stamp(next, "gmb", collectedAt),
  };
  return finishPatch(
    { ...withGmb, fonte: stamp(withGmb, "maps", collectedAt) },
    options.scoreProfile ?? "b2c_local",
  );
}

export function normalizeCompanyDomain(raw: string): string | null {
  return parseCompanySite(raw)?.host ?? null;
}

function stamp(
  row: LeadEnrichment,
  key: string,
  collectedAt: string,
  extra: { path?: string } = {},
): LeadEnrichment["fonte"] {
  return {
    ...row.fonte,
    [key]: { fonte: "human", coletado_em: collectedAt, ...extra },
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
  // WhatsApp Business accepts landlines; reject 0800/0300/etc.
  if (!phone || phone.tipo === "especial") {
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
    homepage_path: null,
    domain_status: "nao_encontrado",
    http_status: null,
    discarded_domains: [...discarded],
    fonte: stamp(row, "domain", collectedAt),
  };
}

export function companyHostsEqual(
  left: string | null | undefined,
  right: string,
): boolean {
  if (!left) return false;
  const a = normalizeCompanyDomain(left);
  const b = normalizeCompanyDomain(right);
  return Boolean(a && b && a === b);
}

/** Human said this candidate is the company site — persist before the recrawl. */
export function applySiteConfirm(
  row: LeadEnrichment,
  domain: string,
  options: { scoreProfile?: ScoreProfile; now?: Date } = {},
): LeadEnrichment {
  const site = parseCompanySite(domain);
  if (!site) {
    throw new PresenceCorrectionError("Domínio inválido.");
  }
  const collectedAt = (options.now ?? new Date()).toISOString();
  return finishPatch(
    {
      ...row,
      domain: site.host,
      homepage_path: site.homepagePath,
      domain_status: "confirmado",
      fonte: stamp(
        row,
        "domain",
        collectedAt,
        site.homepagePath ? { path: site.homepagePath } : {},
      ),
    },
    options.scoreProfile ?? "b2c_local",
  );
}

/** Human said this candidate is wrong — drop it and keep it out of the next search. */
export function applySiteReject(
  row: LeadEnrichment,
  domain: string,
  options: { scoreProfile?: ScoreProfile; now?: Date } = {},
): LeadEnrichment {
  const host = normalizeCompanyDomain(domain);
  if (!host) {
    throw new PresenceCorrectionError("Domínio inválido.");
  }
  const collectedAt = (options.now ?? new Date()).toISOString();
  const discarded = new Set(row.discarded_domains ?? []);
  discarded.add(host);
  if (row.domain) {
    const current = normalizeCompanyDomain(row.domain);
    if (current) discarded.add(current);
  }
  const cleared = companyHostsEqual(row.domain, host)
    ? clearDomain(row, collectedAt)
    : row;
  return finishPatch(
    {
      ...cleared,
      discarded_domains: [...discarded],
      fonte: stamp(cleared, "domain", collectedAt),
    },
    options.scoreProfile ?? "b2c_local",
  );
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

  const mapsRaw =
    correction.maps !== undefined ? correction.maps : correction.gmb;
  if (correction.confirmMaps === true && mapsRaw === undefined) {
    return {
      kind: "patch",
      row: applyMapsConfirm(row, { scoreProfile, now: options.now }),
    };
  }

  if (correction.confirmInstagram !== undefined) {
    const next = applyInstagramCandidate(row, correction.confirmInstagram, {
      scoreProfile,
      now: options.now,
    });
    return { kind: "patch", row: next };
  }

  if (correction.domain !== undefined) {
    if (correction.domain == null || correction.domain.trim() === "") {
      return {
        kind: "patch",
        row: finishPatch(clearDomain(row, collectedAt), scoreProfile),
      };
    }
    const patched = applySiteConfirm(row, correction.domain, {
      scoreProfile,
      now: options.now,
    });
    return {
      kind: "recrawl",
      domain: patched.domain!,
      homepagePath: patched.homepage_path ?? null,
      row: patched,
    };
  }

  const next: LeadEnrichment = { ...row, socials: { ...row.socials } };

  if (correction.instagram !== undefined) {
    if (correction.instagram == null || correction.instagram.trim() === "") {
      next.socials = dropSocial(next.socials, "instagram");
    } else {
      next.socials.instagram = instagramUrl(correction.instagram);
    }
    next.fonte = stamp(next, "instagram", collectedAt);
    next.presence_candidates = clearInstagramCandidates(next);
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

  if (mapsRaw !== undefined) {
    if (mapsRaw == null || mapsRaw.trim() === "") {
      next.gmb = { name: "", url: "", matched: false, status: "none" };
    } else {
      const url = gmbUrl(mapsRaw);
      if (mapsSearchUrl(url)) {
        throw new PresenceCorrectionError(
          "Cole a ficha do Maps, não o link da busca.",
        );
      }
      const cid = cidFromMapsUrl(url);
      next.gmb = {
        name:
          mapsPlaceNameFromUrl(url) ||
          options.companyName?.trim() ||
          row.gmb?.name ||
          "Google Maps",
        url: cid ? mapsCidUrl(cid) : url,
        matched: true,
        status: "matched",
        ...(cid ? { cid } : {}),
        ...(row.gmb?.card ? { card: row.gmb.card } : {}),
      };
    }
    next.fonte = stamp(next, "gmb", collectedAt);
    next.fonte = stamp(next, "maps", collectedAt);
  }

  return { kind: "patch", row: finishPatch(next, scoreProfile) };
}
