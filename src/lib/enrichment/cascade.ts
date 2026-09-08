import { domainHostMatchesBrand, quotedAliasPlaceQueries } from "@/lib/enrichment/brand-aliases";
import { confirmDomainOwnership, presenceBrandTokens } from "@/lib/enrichment/confirm-domain";
import { domainSearchQueries } from "@/lib/enrichment/company-name";
import { isDirectoryUrl } from "@/lib/enrichment/directory-blocklist";
import { stampDiscoveryFonte } from "@/lib/enrichment/discovery";
import { extractPeople } from "@/lib/enrichment/extract-people";
import {
  extractContacts,
  extractNormalizedPhones,
  extractSiteBrand,
  harvestMarkupFromAssetText,
  isSpaShell,
  listSpaScriptUrls,
  maxSpaScriptBytes,
} from "@/lib/enrichment/extract";
import {
  applyMapsWebsiteAssets,
  domainFromGmb,
  mapsWebsiteAssets,
  pickBestDomainHit,
  searchGmb,
  searchInstagramProfile,
  upgradeGmbWithWebsite,
  serperOrganic,
  socialFonteFromHit,
  socialsFromHits,
  type GmbSearchInput,
  type OrganicHit,
} from "@/lib/enrichment/presence";
import {
  homeFetchCandidates,
  homepagePathFromUrl,
  normalizeHomepagePath,
} from "@/lib/enrichment/company-site";
import { pathAllowedByRobots } from "@/lib/enrichment/robots";
import { detectCopyrightYear, detectTech, midiaPagaLabel } from "@/lib/enrichment/tech";
import {
  noteDomainWave,
  serperDensityFromRow,
  withSerperStage,
  withSerperStats,
  type SerperDensitySummary,
} from "@/lib/enrichment/serper-stats";
import {
  deriveSeal,
  hasAccountantDomainHint,
  isFreeEmail,
  emailDomainCorrelatesWithBrand,
  receitaEmailHost,
  receitaProviderDomain,
} from "@/lib/contact-confidence";
import { normalizePhoneBR, sameNumberBR } from "@/lib/phone";
import { computeDorDigital } from "@/lib/scoring";
import { buildGoldenMinute } from "@/lib/golden-minute";
import type {
  Company,
  DomainStatus,
  EnrichmentStage,
  Establishment,
  GmbListing,
  LeadEnrichment,
  PhoneEvidence,
  PhoneSource,
  SharedPhoneVerdict,
  SitePerson,
  TechSignals,
} from "@/lib/types";
import { gmbListingCorroborated } from "@/lib/types";

export const GRID_USER_AGENT =
  "Mozilla/5.0 (compatible; GridBot/1.0; +https://grid.mundopodium.com.br/bot)";

const FETCH_PAGE_TIMEOUT_MS = 10_000;
const FETCH_PAGE_MAX_BYTES = 1.5 * 1024 * 1024;
const FETCH_RETRY_GAP_MS = 300;

const HOME_PATH = "/";
/** Paths used to prove the domain belongs to the company. */
const OWNERSHIP_PATHS = [
  HOME_PATH,
  "/quem-somos",
  "/equipe",
  "/time",
  "/diretoria",
  "/sobre",
];
/** Paths crawled after confirmation to harvest contacts/socials. */
const HARVEST_PATHS = [
  HOME_PATH,
  "/contato",
  "/contact",
  "/fale-conosco",
  "/sobre",
  "/quem-somos",
];
export const HOME_PAGE_GAP_MS = 500;
export const INNER_PAGE_GAP_MS = 150;
const MAX_CRAWL_PAGES = 8;

const lastHitByHost = new Map<string, number>();
const robotsTxtByOrigin = new Map<string, Promise<string | null>>();
const SPA_ASSET_GAP_MS = 300;

export type EnrichProgress = (row: LeadEnrichment) => void | Promise<void>;

export type EnrichTimings = {
  serper_ms: number;
  crawl_ms: number;
  pages: number;
  osm_ms: number;
  progress_ms: number;
  serper: SerperDensitySummary;
};

function elapsed(started: number): number {
  return Date.now() - started;
}

export async function respectRateLimit(
  host: string,
  minGapMs = HOME_PAGE_GAP_MS,
): Promise<void> {
  const last = lastHitByHost.get(host) ?? 0;
  const wait = minGapMs - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHitByHost.set(host, Date.now());
}

function loadRobots(origin: string): Promise<string | null> {
  const hit = robotsTxtByOrigin.get(origin);
  if (hit) return hit;
  const pending = (async () => {
    try {
      const res = await fetch(`${origin}/robots.txt`, {
        headers: { "User-Agent": GRID_USER_AGENT },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  })();
  robotsTxtByOrigin.set(origin, pending);
  return pending;
}

export async function allowedByRobots(origin: string, path: string): Promise<boolean> {
  const text = await loadRobots(origin);
  if (!text) return true;
  return pathAllowedByRobots(text, path, "GridBot");
}

/**
 * Keep the storefront status the card shows. Home 200 must not be replaced
 * by a later harvest 404 (/contato); a later usable page may replace a 4xx.
 */
export function rememberStorefrontStatus(
  current: number | null,
  page: { html: string; status: number },
): number {
  const usable = page.status < 400 && page.html.trim().length > 0;
  if (usable) {
    if (current == null || current >= 400) return page.status;
    return current;
  }
  return current ?? page.status;
}

/** Apex ↔ www twin. Same host identity; some stacks only answer on one of them. */
export function swapWwwOrigin(origin: string): string | null {
  try {
    const u = new URL(origin.includes("://") ? origin : `https://${origin}`);
    const host = u.hostname;
    if (!host || host === "localhost" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
      return null;
    }
    u.hostname = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
    return u.origin;
  } catch {
    return null;
  }
}

function isAbortOrTimeout(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || err.name === "TimeoutError")
  );
}

const PAGE_HEADERS = {
  "User-Agent": GRID_USER_AGENT,
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
} as const;

async function fetchOnce(
  url: string,
): Promise<{ html: string; status: number; finalUrl: string }> {
  const res = await fetch(url, {
    headers: PAGE_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_PAGE_TIMEOUT_MS),
  });
  const buf = await res.arrayBuffer();
  const sliced =
    buf.byteLength > FETCH_PAGE_MAX_BYTES
      ? buf.slice(0, FETCH_PAGE_MAX_BYTES)
      : buf;
  const html = new TextDecoder("utf-8", { fatal: false }).decode(sliced);
  return { html, status: res.status, finalUrl: res.url };
}

async function fetchPage(
  url: string,
  minGapMs = HOME_PAGE_GAP_MS,
): Promise<{ html: string; status: number; finalUrl: string } | null> {
  const u = new URL(url);
  if (!(await allowedByRobots(u.origin, u.pathname))) return null;
  await respectRateLimit(u.host, minGapMs);
  try {
    return await fetchOnce(url);
  } catch (err) {
    if (isAbortOrTimeout(err)) return null;
    await new Promise((r) => setTimeout(r, FETCH_RETRY_GAP_MS));
    try {
      return await fetchOnce(url);
    } catch {
      return null;
    }
  }
}

export function domainFromEmail(
  email: string | null,
  brand?: {
    razaoSocial: string;
    nomeFantasia: string | null;
    municipio: string;
    emailShared?: boolean;
  },
): string | null {
  if (!email || !email.includes("@")) return null;
  if (isFreeEmail(email) || hasAccountantDomainHint(email)) return null;
  const host = email.split("@")[1]?.toLowerCase();
  if (!host) return null;
  if (isDirectoryUrl(`https://${host}/`)) return null;
  if (brand) {
    if (
      !emailDomainCorrelatesWithBrand(
        email,
        brand.razaoSocial,
        brand.nomeFantasia,
        brand.municipio,
      )
    ) {
      return null;
    }
  }
  return host;
}

export async function serperSearch(
  query: string,
  excludeHosts: string[] = [],
  brand?: {
    razaoSocial: string;
    nomeFantasia: string | null;
    municipio: string;
  },
): Promise<string | null> {
  const hits = await serperOrganic(query);
  if (brand) {
    const best = pickBestDomainHit(
      hits,
      brand.razaoSocial,
      brand.nomeFantasia,
      brand.municipio,
      excludeHosts,
    );
    if (!best) return null;
    try {
      return new URL(best.link).origin;
    } catch {
      return null;
    }
  }
  const blocked = new Set(
    excludeHosts.map((h) => h.replace(/^https?:\/\//, "").toLowerCase()),
  );
  for (const hit of hits) {
    if (isDirectoryUrl(hit.link)) continue;
    try {
      const url = new URL(hit.link);
      if (blocked.has(url.host.toLowerCase())) continue;
      return url.origin;
    } catch {
      continue;
    }
  }
  return null;
}

function receitaGmbInput(
  est: Establishment,
  company: Company,
  municipioNome: string,
  sharedVerdict?: SharedPhoneVerdict,
  cnaeDescricao?: string | null,
): GmbSearchInput {
  return {
    nomeFantasia: est.nome_fantasia,
    razaoSocial: company.razao_social,
    municipio: municipioNome,
    uf: est.uf,
    logradouro: est.logradouro,
    numero: est.numero,
    cep: est.cep,
    phones: [
      { ddd: est.ddd1, telefone: est.telefone1 },
      { ddd: est.ddd2, telefone: est.telefone2 },
    ],
    sharedVerdict,
    receitaEmail: est.email,
    cnaeDescricao,
  };
}

function absorbSearchSocials(
  hits: OrganicHit[],
  brand: {
    razaoSocial: string;
    nomeFantasia: string | null;
    municipio: string;
  },
  blockedLabels: string[],
  allowWeakBrand: boolean,
  bag: LeadEnrichment["socials"],
  fonte: LeadEnrichment["fonte"],
  collectedAt: string,
): LeadEnrichment["socials"] {
  const found = socialsFromHits(
    hits,
    brand.razaoSocial,
    brand.nomeFantasia,
    brand.municipio,
    blockedLabels,
    allowWeakBrand,
  );
  const next = { ...bag };
  for (const platform of ["instagram", "facebook", "linkedin", "youtube"] as const) {
    const url = found[platform];
    if (!url || next[platform]) continue;
    next[platform] = url;
    fonte[platform] = {
      fonte: socialFonteFromHit(hits, url),
      coletado_em: collectedAt,
    };
  }
  return next;
}

export type CascadeCompany = {
  establishment: Establishment;
  company: Company;
  municipioNome: string;
  sharedCount: number;
  sharedVerdict: SharedPhoneVerdict;
  scoreProfile: "b2c_local" | "b2b_industria";
  qsaNomes?: string[];
  cnaeDescricao?: string | null;
};

export type EnrichOptions = {
  discardedDomains?: string[];
  forceConfirmDomain?: string | null;
  /** Shallow storefront (`/home`) when `/` is not the live site. */
  homepagePath?: string | null;
  /** Receita e-mail appears on many CNPJs — provider unless the host is the brand. */
  emailShared?: boolean;
  extraNames?: string[];
  seedDomain?: string | null;
  seedInstagram?: string | null;
  /** Keep the first-pass pin; confirm recrawl must not pay Maps again. */
  seedGmb?: GmbListing | null;
  seedSocials?: LeadEnrichment["socials"];
};

type SitePhone = NonNullable<ReturnType<typeof extractNormalizedPhones>>[number];

function buildPhoneEvidences(input: {
  domainStatus: DomainStatus;
  receita: ReturnType<typeof normalizePhoneBR>;
  sitePhones: SitePhone[];
  sharedCount: number;
  sharedVerdict: SharedPhoneVerdict;
  mapsPhoneMatch?: boolean;
  mapsPhone?: ReturnType<typeof normalizePhoneBR> | null;
}): PhoneEvidence[] {
  const derived = deriveSeal({
    domainStatus: input.domainStatus,
    receita: input.receita,
    sitePhones: input.sitePhones,
    sharedCount: input.sharedCount,
    sharedVerdict: input.sharedVerdict,
    mapsPhoneMatch: input.mapsPhoneMatch === true,
  });
  const evidences: PhoneEvidence[] = [];
  const pushEvidence = (
    n: NonNullable<ReturnType<typeof normalizePhoneBR>>,
    sources: PhoneSource[],
    isWhatsApp: boolean,
    sealOverride?: PhoneEvidence["seal"],
  ) => {
    if (evidences.some((e) => e.e164 === n.e164)) {
      const existing = evidences.find((e) => e.e164 === n.e164)!;
      for (const s of sources) {
        if (!existing.sources.includes(s)) existing.sources.push(s);
      }
      if (isWhatsApp) existing.isWhatsApp = true;
      if (
        sources.includes("maps") &&
        existing.seal !== "CONFIRMADO" &&
        existing.seal !== "ATUALIZADO"
      ) {
        existing.seal = "MAPS";
      }
      return;
    }
    evidences.push({
      e164: n.e164,
      display: n.display,
      tipo: n.tipo,
      sources,
      isWhatsApp,
      sharedCount: input.sharedCount,
      sharedVerdict: input.sharedVerdict,
      seal: sealOverride ?? derived.seal,
    });
  };

  if (input.receita) {
    const onSite =
      input.domainStatus === "confirmado" &&
      input.sitePhones.some((p) => sameNumberBR(p, input.receita!));
    const onMaps = input.mapsPhoneMatch === true;
    pushEvidence(
      input.receita,
      [
        "receita",
        ...(onSite ? (["site_tel"] as const) : []),
        ...(onMaps ? (["maps"] as const) : []),
      ],
      false,
      onSite
        ? "CONFIRMADO"
        : onMaps
          ? "MAPS"
          : derived.principalIsSite
            ? undefined
            : derived.seal,
    );
  }
  if (input.domainStatus === "confirmado") {
    for (const p of input.sitePhones) {
      const matchReceita = input.receita && sameNumberBR(p, input.receita);
      pushEvidence(
        p,
        [p.source as PhoneSource],
        p.isWhatsApp,
        matchReceita ? "CONFIRMADO" : "ATUALIZADO",
      );
    }
  }
  if (
    input.mapsPhone &&
    input.sharedVerdict !== "contabilidade"
  ) {
    const already = evidences.some((e) => e.e164 === input.mapsPhone!.e164);
    if (!already) {
      pushEvidence(input.mapsPhone, ["maps"], false, "MAPS");
    } else {
      pushEvidence(input.mapsPhone, ["maps"], false);
    }
  }

  evidences.sort((a, b) => {
    const rank: Record<string, number> = {
      CONFIRMADO: 5,
      ATUALIZADO: 4,
      MAPS: 4,
      GRUPO: 3,
      NAO_CONFIRMADO: 2,
      COMPARTILHADO: 1,
    };
    return (rank[b.seal] ?? 0) - (rank[a.seal] ?? 0);
  });
  return evidences;
}

function snapshotFromHtml(input: {
  confirmed: boolean;
  html: string;
  finalUrl: string;
  domain: string | null;
  ddd1: string | null;
  qsaNomes: string[];
  collectedAt: string;
}): {
  tech: TechSignals;
  emails: LeadEnrichment["emails"];
  socials: LeadEnrichment["socials"];
  sitePhones: SitePhone[];
  freshness: LeadEnrichment["freshness"];
  people: SitePerson[];
} {
  const confirmed = input.confirmed;
  const tech = confirmed
    ? detectTech(input.html, input.finalUrl || (input.domain ? `https://${input.domain}` : ""))
    : detectTech("", "");
  const extracted = extractContacts(input.html, input.ddd1);
  return {
    tech,
    emails: confirmed
      ? extracted.emails.map((valor) => ({
          valor,
          fonte: "site_mailto",
          coletado_em: input.collectedAt,
        }))
      : [],
    // Socials from HTML only count once ownership is confirmed (wrong domain → wrong IG).
    socials: confirmed ? extracted.socials : {},
    sitePhones: confirmed ? extractNormalizedPhones(input.html, input.ddd1) : [],
    freshness: {
      copyrightYear: confirmed ? detectCopyrightYear(input.html) : undefined,
    },
    people: confirmed ? extractPeople(input.html, { qsaNomes: input.qsaNomes }) : [],
  };
}

export async function enrichCompany(
  input: CascadeCompany,
  cachedDomain?: { domain: string | null; status: string } | null,
  onProgress?: EnrichProgress,
  options: EnrichOptions = {},
): Promise<{ row: LeadEnrichment; timings: EnrichTimings }> {
  return withSerperStats(() =>
    enrichCompanyTracked(input, cachedDomain, onProgress, options),
  );
}

async function enrichCompanyTracked(
  input: CascadeCompany,
  cachedDomain?: { domain: string | null; status: string } | null,
  onProgress?: EnrichProgress,
  options: EnrichOptions = {},
): Promise<{ row: LeadEnrichment; timings: EnrichTimings }> {
  const now = new Date();
  const collected_at = now.toISOString();
  const expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const est = input.establishment;
  const normalizeHost = (h: string) =>
    h.replace(/^https?:\/\//, "").replace(/^www\./, "").toLowerCase();
  const gmbConfirmsDomain = (
    listing: GmbListing | null,
    host: string | null,
  ): boolean => {
    if (!host || !gmbListingCorroborated(listing)) return false;
    const fromMaps = domainFromGmb(listing);
    return Boolean(fromMaps && normalizeHost(fromMaps) === normalizeHost(host));
  };
  const discarded = new Set(
    (options.discardedDomains ?? []).map(normalizeHost).filter(Boolean),
  );
  const emailBrand = {
    razaoSocial: input.company.razao_social,
    nomeFantasia: est.nome_fantasia,
    municipio: input.municipioNome,
  };
  // Shared / accountant Receita e-mail → never treat that host as the company site.
  // Branded shared hosts (national franchise) stay eligible.
  const providerHost = receitaProviderDomain(est.email, {
    shared: options.emailShared === true,
    accountantHint: hasAccountantDomainHint(est.email),
    brand: emailBrand,
  });
  if (providerHost) discarded.add(providerHost);
  // Prior runs stored franchise hosts in discarded_domains — drop them on retry.
  if (
    !hasAccountantDomainHint(est.email) &&
    emailDomainCorrelatesWithBrand(
      est.email,
      emailBrand.razaoSocial,
      emailBrand.nomeFantasia,
      emailBrand.municipio,
    )
  ) {
    const brandedHost = receitaEmailHost(est.email);
    if (brandedHost) discarded.delete(normalizeHost(brandedHost));
  }
  const blockedSocialLabels = providerHost
    ? [providerHost.split(".")[0] ?? providerHost]
    : [];
  const forceHost = options.forceConfirmDomain
    ? normalizeHost(options.forceConfirmDomain)
    : null;
  let homepage_path = normalizeHomepagePath(options.homepagePath);
  const fonte: LeadEnrichment["fonte"] = stampDiscoveryFonte(
    {},
    collected_at,
  );

  const cachedHost = cachedDomain?.domain
    ? normalizeHost(cachedDomain.domain)
    : "";
  const cacheUsable = Boolean(
    cachedHost &&
      !discarded.has(cachedHost) &&
      !isDirectoryUrl(cachedHost) &&
      domainHostMatchesBrand(
        cachedHost,
        input.company.razao_social,
        est.nome_fantasia,
        input.municipioNome,
      ),
  );
  let domain: string | null = forceHost
    ? forceHost
    : cacheUsable
      ? cachedHost
      : null;
  let domain_status: DomainStatus = forceHost
    ? "confirmado"
    : domain
      ? ((cachedDomain?.status as DomainStatus) ?? "nao_confirmado")
      : "nao_encontrado";
  let http_status: number | null = null;
  let combinedHtml = "";
  let finalUrl = "";
  let gmb: GmbListing | null = options.seedGmb ?? null;
  let socialsFromSearch: LeadEnrichment["socials"] = {
    ...options.seedSocials,
  };
  let presenceCandidates: LeadEnrichment["presence_candidates"] = null;
  if (gmb) {
    fonte.gmb = { fonte: "serper", coletado_em: collected_at };
  }
  const timings: Omit<EnrichTimings, "serper"> = {
    serper_ms: 0,
    crawl_ms: 0,
    pages: 0,
    osm_ms: 0,
    progress_ms: 0,
  };
  let persistTail = Promise.resolve();

  if (forceHost) noteDomainWave("human");
  else if (cacheUsable) noteDomainWave("cache");

  if (!domain) {
    const fromEmail = domainFromEmail(est.email, {
      razaoSocial: input.company.razao_social,
      nomeFantasia: est.nome_fantasia,
      municipio: input.municipioNome,
      emailShared: options.emailShared === true,
    });
    if (fromEmail && !discarded.has(normalizeHost(fromEmail))) {
      domain = fromEmail;
      fonte.domain = { fonte: "email_receita", coletado_em: collected_at };
      noteDomainWave("email");
    }
  } else if (forceHost) {
    fonte.domain = {
      fonte: "human",
      coletado_em: collected_at,
      ...(homepage_path ? { path: homepage_path } : {}),
    };
  }

  if (!domain && options.seedDomain) {
    const seedHost = normalizeHost(options.seedDomain);
    if (
      seedHost &&
      !discarded.has(seedHost) &&
      !isDirectoryUrl(seedHost) &&
      domainHostMatchesBrand(
        seedHost,
        input.company.razao_social,
        est.nome_fantasia,
        input.municipioNome,
      )
    ) {
      domain = seedHost;
      fonte.domain = { fonte: "hint", coletado_em: collected_at };
      noteDomainWave("hint");
    }
  }

  if (options.seedInstagram) {
    socialsFromSearch = {
      ...socialsFromSearch,
      instagram: `https://instagram.com/${options.seedInstagram}`,
    };
    fonte.instagram = { fonte: "hint", coletado_em: collected_at };
  } else if (socialsFromSearch.instagram && !fonte.instagram) {
    fonte.instagram = { fonte: "serper", coletado_em: collected_at };
  }

  if (!domain) domain_status = "nao_encontrado";
  else if (domain_status === "nao_encontrado") domain_status = "nao_confirmado";

  const assemble = (
    stage: EnrichmentStage,
    extras: {
      tech?: TechSignals;
      emails?: LeadEnrichment["emails"];
      socials?: LeadEnrichment["socials"];
      sitePhones?: SitePhone[];
      freshness?: LeadEnrichment["freshness"];
      people?: SitePerson[] | null;
      gmb?: GmbListing | null;
    } = {},
  ): LeadEnrichment => {
    const sitePhones = extras.sitePhones ?? [];
    const receita = normalizePhoneBR(
      `${est.ddd1 ?? ""}${est.telefone1 ?? ""}`,
      est.ddd1,
    );
    const listing = extras.gmb ?? gmb;
    const mapsPhone =
      listing?.matched && listing.phone_e164
        ? normalizePhoneBR(listing.phone_e164)
        : null;
    const phones = buildPhoneEvidences({
      domainStatus: domain_status,
      receita,
      sitePhones,
      sharedCount: input.sharedCount,
      sharedVerdict: input.sharedVerdict,
      mapsPhoneMatch: listing?.phone_vs_receita === "igual",
      mapsPhone,
    });
    const tech = extras.tech ?? detectTech("", "");
    const mergedSocials: LeadEnrichment["socials"] = {
      instagram: extras.socials?.instagram ?? socialsFromSearch.instagram,
      facebook: extras.socials?.facebook ?? socialsFromSearch.facebook,
      linkedin: extras.socials?.linkedin ?? socialsFromSearch.linkedin,
      youtube: extras.socials?.youtube ?? socialsFromSearch.youtube,
    };
    const row: LeadEnrichment = {
      cnpj: est.cnpj,
      domain: domain ? domain.replace(/^https?:\/\//, "") : null,
      homepage_path,
      domain_status,
      http_status,
      phones,
      emails: extras.emails ?? [],
      whatsapp:
        (
          phones.find((e) => e.isWhatsApp && e.tipo === "movel") ??
          phones.find((e) => e.isWhatsApp)
        )?.e164?.replace("+", "") ?? null,
      socials: mergedSocials,
      tech,
      freshness: extras.freshness ?? {},
      osm: null,
      gmb: extras.gmb ?? gmb,
      discarded_domains: [...discarded],
      presence_candidates: mergedSocials.instagram
        ? null
        : presenceCandidates,
      dor_digital: 0,
      contexto: [],
      fonte,
      midiaPaga: midiaPagaLabel(tech, domain_status === "confirmado"),
      people: extras.people,
      stage,
      collected_at,
      expires_at,
    };
    if (stage === "complete") {
      row.dor_digital = computeDorDigital(input.scoreProfile, row);
      const gm = buildGoldenMinute(row);
      row.contexto = gm.insufficient ? [] : gm.facts.map((f) => f.phrase);
    }
    return row;
  };

  const emit = async (row: LeadEnrichment): Promise<LeadEnrichment> => {
    persistTail = persistTail.then(async () => {
      const t = Date.now();
      try {
        await onProgress?.(row);
      } catch {
        /* final upsert in processJob is authoritative */
      }
      timings.progress_ms += elapsed(t);
    });
    return row;
  };

  const flushProgress = async (row: LeadEnrichment): Promise<LeadEnrichment> => {
    await emit(row);
    await persistTail;
    return row;
  };

  await emit(assemble("domain", { people: null }));

  const brand = {
    razaoSocial: input.company.razao_social,
    nomeFantasia: est.nome_fantasia,
    municipio: input.municipioNome,
  };
  const gmbInput = receitaGmbInput(
    est,
    input.company,
    input.municipioNome,
    input.sharedVerdict,
    input.cnaeDescricao,
  );
  gmbInput.extraNames = options.extraNames;
  const presencePlace = {
    nomeFantasia: est.nome_fantasia,
    razaoSocial: input.company.razao_social,
    municipio: input.municipioNome,
    uf: est.uf,
  };

  if (!domain) {
    const serperStarted = Date.now();
    const exclude = [...discarded];

    const queryInput = {
      nomeFantasia: est.nome_fantasia,
      razaoSocial: input.company.razao_social,
      municipio: input.municipioNome,
      uf: est.uf,
    };
    const queries = [
      ...domainSearchQueries(queryInput),
      ...quotedAliasPlaceQueries({
        nomeFantasia: est.nome_fantasia,
        razaoSocial: input.company.razao_social,
        extraNames: options.extraNames,
        municipio: input.municipioNome,
        uf: est.uf,
      }),
    ]
      .filter((q, i, all) => q && all.indexOf(q) === i)
      .slice(0, 2);
    const strongBrand =
      presenceBrandTokens(brand.razaoSocial, brand.nomeFantasia, brand.municipio)
        .length > 0;
    const absorbHits = (hits: OrganicHit[]) => {
      socialsFromSearch = absorbSearchSocials(
        hits,
        brand,
        blockedSocialLabels,
        strongBrand,
        socialsFromSearch,
        fonte,
        collected_at,
      );
    };
    const hitSets: OrganicHit[][] = [];
    let pooledHits: OrganicHit[] = [];
    let best = null as ReturnType<typeof pickBestDomainHit>;
    let domainWave: "primary" | "fallback" | "national" | null = null;
    await withSerperStage("domain", async () => {
      for (const q of queries) {
        const hits = await serperOrganic(q);
        hitSets.push(hits);
        absorbHits(hits);
        pooledHits = hitSets.flat();
        best = pickBestDomainHit(
          pooledHits,
          brand.razaoSocial,
          brand.nomeFantasia,
          brand.municipio,
          exclude,
        );
        if (best) {
          domainWave = "primary";
          break;
        }
      }
    });
    const gmbSeed = await withSerperStage("gmb", () => searchGmb(gmbInput));
    if (best) {
      try {
        const host = normalizeHost(new URL(best.link).host);
        if (!discarded.has(host) && !isDirectoryUrl(best.link)) {
          domain = host;
          homepage_path = homepagePathFromUrl(best.link);
          fonte.domain = {
            fonte: "serper",
            coletado_em: collected_at,
            ...(homepage_path ? { path: homepage_path } : {}),
          };
          domain_status = "nao_confirmado";
          if (domainWave) noteDomainWave(domainWave);
          await emit(assemble("domain", { people: null }));
        }
      } catch {
        /* invalid URL */
      }
    }

    if (gmbSeed) {
      gmb = gmbSeed;
      fonte.gmb = { fonte: "serper", coletado_em: collected_at };
    }
    if (!domain && gmbSeed?.matched) {
      const fromMaps = domainFromGmb(gmbSeed);
      if (
        fromMaps &&
        !discarded.has(normalizeHost(fromMaps)) &&
        !isDirectoryUrl(fromMaps)
      ) {
        domain = fromMaps;
        fonte.domain = { fonte: "gmb", coletado_em: collected_at };
        domain_status = "nao_confirmado";
        noteDomainWave("gmb");
        await emit(assemble("domain", { people: null }));
      }
    }
    timings.serper_ms = elapsed(serperStarted);
  }

  let snap = snapshotFromHtml({
    confirmed: false,
    html: "",
    finalUrl: "",
    domain,
    ddd1: est.ddd1,
    qsaNomes: input.qsaNomes ?? [],
    collectedAt: collected_at,
  });

  let siteBrand: string | null = null;

  if (domain) {
    let origin = domain.startsWith("http") ? domain : `https://${domain}`;
    let pages = 0;
    let confirmed = Boolean(forceHost);
    let homeEmitted = false;
    const visited = new Set<string>();
    const crawlStarted = Date.now();

    const pageUsable = (
      page: { html: string; status: number } | null,
    ): boolean =>
      Boolean(page && page.status < 400 && page.html.trim().length > 0);

    const fetchAndAccumulate = async (
      path: string,
      minGap: number,
      mode: "any" | "usable" = "any",
    ): Promise<boolean> => {
      if (visited.has(path) || pages >= MAX_CRAWL_PAGES) return false;
      visited.add(path);
      const page = await fetchPage(`${origin}${path}`, minGap);
      pages += 1;
      if (!page) return false;
      http_status = rememberStorefrontStatus(http_status, page);
      if (pageUsable(page) || !finalUrl) finalUrl = page.finalUrl;
      if (mode === "usable" && !pageUsable(page)) return false;
      combinedHtml += `\n${page.html}`;
      return true;
    };

    const stampHomePath = (path: string) => {
      homepage_path = normalizeHomepagePath(path);
      if (!fonte.domain) {
        fonte.domain = {
          fonte: forceHost ? "human" : "crawl",
          coletado_em: collected_at,
        };
      }
      if (homepage_path) {
        fonte.domain = { ...fonte.domain, path: homepage_path };
      } else if (fonte.domain.path) {
        const { path: _dropped, ...rest } = fonte.domain;
        fonte.domain = rest;
      }
    };

    const resolveHome = async (): Promise<boolean> => {
      const first = homeFetchCandidates(homepage_path)[0] ?? HOME_PATH;
      let ok = await fetchAndAccumulate(first, HOME_PAGE_GAP_MS, "usable");
      if (!ok) {
        const alt = swapWwwOrigin(origin);
        if (alt) {
          visited.delete(first);
          origin = alt;
          ok = await fetchAndAccumulate(first, HOME_PAGE_GAP_MS, "usable");
        }
      }
      if (!ok) return false;
      stampHomePath(first);
      return true;
    };

    const homeOk = await resolveHome();

    const applyOwnershipHtml = () => {
      const htmlOwnershipOk =
        Boolean(forceHost) ||
        gmbConfirmsDomain(gmb, domain) ||
        (domain != null &&
          domainHostMatchesBrand(
            domain,
            input.company.razao_social,
            est.nome_fantasia,
            input.municipioNome,
          ));
      if (
        !confirmed &&
        htmlOwnershipOk &&
        confirmDomainOwnership({
          html: combinedHtml,
          cnpj: est.cnpj,
          razaoSocial: input.company.razao_social,
          nomeFantasia: est.nome_fantasia,
          municipio: input.municipioNome,
        })
      ) {
        confirmed = true;
      }
      if (!confirmed && gmbConfirmsDomain(gmb, domain)) {
        confirmed = true;
      }
      if (forceHost) confirmed = true;
      domain_status = confirmed ? "confirmado" : "nao_confirmado";
      snap = snapshotFromHtml({
        confirmed,
        html: combinedHtml,
        finalUrl,
        domain,
        ddd1: est.ddd1,
        qsaNomes: input.qsaNomes ?? [],
        collectedAt: collected_at,
      });
    };

    if (homeOk) {
      applyOwnershipHtml();
    }
    if (!homeEmitted) {
      await emit(
        assemble("home", {
          tech: homeOk ? snap.tech : undefined,
          emails: homeOk ? snap.emails : undefined,
          socials: homeOk ? snap.socials : undefined,
          sitePhones: homeOk ? snap.sitePhones : undefined,
          freshness: homeOk ? snap.freshness : undefined,
          people: homeOk ? snap.people : [],
        }),
      );
      homeEmitted = true;
    }
    if (homeOk && confirmed) {
      /* harvest below */
    } else {
      for (const path of OWNERSHIP_PATHS) {
        if (path === HOME_PATH) continue;
        if (pages >= MAX_CRAWL_PAGES) break;
        if (confirmed) break;

        const ok = await fetchAndAccumulate(path, INNER_PAGE_GAP_MS);
        if (!ok) continue;
        applyOwnershipHtml();
        if (confirmed) break;
      }
    }

    // --- Harvest pass: after confirmation, collect contact/social pages ---
    if (confirmed || forceHost) {
      confirmed = true;
      domain_status = "confirmado";
      const harvestHome = homepage_path ?? HOME_PATH;
      for (const path of HARVEST_PATHS) {
        if (pages >= MAX_CRAWL_PAGES) break;
        const target = path === HOME_PATH ? harvestHome : path;
        await fetchAndAccumulate(
          target,
          target === harvestHome ? HOME_PAGE_GAP_MS : INNER_PAGE_GAP_MS,
        );
      }
    }

    timings.pages = pages;

    // SPA shells (Vite/React empty #root) hide wa.me / Instagram inside JS bundles.
    if (combinedHtml && isSpaShell(combinedHtml)) {
      const assetUrls = listSpaScriptUrls(combinedHtml, origin);
      for (const assetUrl of assetUrls) {
        try {
          const assetHost = new URL(assetUrl).host;
          await respectRateLimit(assetHost, SPA_ASSET_GAP_MS);
          const res = await fetch(assetUrl, {
            headers: { "User-Agent": GRID_USER_AGENT, Accept: "*/*" },
            redirect: "follow",
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) continue;
          const buf = await res.arrayBuffer();
          if (buf.byteLength > maxSpaScriptBytes()) continue;
          const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
          const harvest = harvestMarkupFromAssetText(text);
          if (harvest) combinedHtml += `\n${harvest}`;
        } catch {
          /* skip failed asset */
        }
      }
    }

    timings.crawl_ms = elapsed(crawlStarted);

    if (forceHost) confirmed = true;
    if (!confirmed && gmbConfirmsDomain(gmb, domain)) confirmed = true;
    domain_status = confirmed ? "confirmado" : domain ? "nao_confirmado" : "nao_encontrado";
    siteBrand = extractSiteBrand(combinedHtml);
    snap = snapshotFromHtml({
      confirmed,
      html: combinedHtml,
      finalUrl,
      domain,
      ddd1: est.ddd1,
      qsaNomes: input.qsaNomes ?? [],
      collectedAt: collected_at,
    });
  }

  const snapExtras = () => ({
    tech: snap.tech,
    emails: snap.emails,
    socials: snap.socials,
    sitePhones: snap.sitePhones,
    freshness: snap.freshness,
    people: snap.people,
    gmb,
  });

  const presenceStarted = Date.now();
  const siteConfirmed = domain_status === "confirmado";
  const brandOverride = siteConfirmed ? siteBrand : null;

  if (!gmb && !forceHost) {
    gmb = await withSerperStage("gmb", () => searchGmb(gmbInput));
    fonte.gmb = { fonte: "serper", coletado_em: collected_at };
  }

  if (domain) {
    const host = domain.replace(/^www\./i, "").toLowerCase();
    const upgraded = upgradeGmbWithWebsite(gmb, host);
    if (upgraded && upgraded !== gmb) {
      gmb = upgraded;
      fonte.gmb = { fonte: "serper", coletado_em: collected_at };
    }
  }

  const mapsAssets = mapsWebsiteAssets(gmb?.website_url);
  socialsFromSearch = {
    instagram: socialsFromSearch.instagram ?? mapsAssets.socials.instagram,
    facebook: socialsFromSearch.facebook ?? mapsAssets.socials.facebook,
    linkedin: socialsFromSearch.linkedin ?? mapsAssets.socials.linkedin,
    youtube: socialsFromSearch.youtube ?? mapsAssets.socials.youtube,
  };
  for (const key of ["instagram", "facebook", "linkedin", "youtube"] as const) {
    if (mapsAssets.socials[key] && !fonte[key]) {
      fonte[key] = { fonte: "gmb", coletado_em: collected_at };
    }
  }

  if (
    domain &&
    domain_status !== "confirmado" &&
    gmbConfirmsDomain(gmb, domain)
  ) {
    domain_status = "confirmado";
    snap = snapshotFromHtml({
      confirmed: true,
      html: combinedHtml,
      finalUrl,
      domain,
      ddd1: est.ddd1,
      qsaNomes: input.qsaNomes ?? [],
      collectedAt: collected_at,
    });
  }

  fonte.presence_scan = { fonte: "presence", coletado_em: collected_at };
  await emit(assemble("presence", snapExtras()));

  if (snap.socials.instagram && !fonte.instagram) {
    fonte.instagram = { fonte: "site", coletado_em: collected_at };
  } else if (
    !forceHost &&
    !snap.socials.instagram &&
    !socialsFromSearch.instagram
  ) {
    const found = await withSerperStage("instagram", () =>
      searchInstagramProfile({
        ...presencePlace,
        brandOverride,
        blockedLabels: blockedSocialLabels,
        cep: est.cep,
        logradouro: est.logradouro,
        numero: est.numero,
        extraNames: [
          ...(options.extraNames ?? []),
          ...(siteBrand ? [siteBrand] : []),
        ],
        websiteHost: siteConfirmed && domain ? domain : undefined,
      }),
    );
    if (found.candidates.length > 0) {
      presenceCandidates = { instagram: found.candidates };
    }
    if (found.url) {
      socialsFromSearch = { ...socialsFromSearch, instagram: found.url };
    }
    fonte.instagram = {
      fonte: found.url ? "serper" : "serper_miss",
      coletado_em: collected_at,
    };
  }
  timings.serper_ms += elapsed(presenceStarted);
  delete fonte.presence_scan;

  await emit(assemble("site", snapExtras()));

  const row = applyMapsWebsiteAssets(
    await flushProgress(assemble("complete", snapExtras())),
    collected_at,
    input.scoreProfile,
  );
  return { row, timings: { ...timings, serper: serperDensityFromRow(row) } };
}
