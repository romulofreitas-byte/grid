import { confirmDomainOwnership } from "@/lib/enrichment/confirm-domain";
import { isDirectoryUrl } from "@/lib/enrichment/directory-blocklist";
import { extractPeople } from "@/lib/enrichment/extract-people";
import { extractContacts, extractNormalizedPhones } from "@/lib/enrichment/extract";
import { pathAllowedByRobots } from "@/lib/enrichment/robots";
import { detectCopyrightYear, detectTech, midiaPagaLabel } from "@/lib/enrichment/tech";
import { deriveSeal, hasAccountantDomainHint, isFreeEmail } from "@/lib/contact-confidence";
import { normalizePhoneBR, sameNumberBR } from "@/lib/phone";
import { computeDorDigital } from "@/lib/scoring";
import { buildGoldenMinute } from "@/lib/golden-minute";
import type {
  Company,
  DomainStatus,
  EnrichmentStage,
  Establishment,
  LeadEnrichment,
  PhoneEvidence,
  PhoneSource,
  SharedPhoneVerdict,
  SitePerson,
  TechSignals,
} from "@/lib/types";

export const GRID_USER_AGENT =
  "GridBot/1.0 (+https://grid.mundopodium.com.br/bot)";

const HOME_PATH = "/";
const INNER_PATHS = [
  "/quem-somos",
  "/equipe",
  "/time",
  "/diretoria",
  "/sobre",
  "/contato",
];
const INNER_PAGE_GAP_MS = 500;

const lastHitByHost = new Map<string, number>();
const robotsTxtByOrigin = new Map<string, Promise<string | null>>();
let playwrightBudgetUsed = 0;
const PLAYWRIGHT_BUDGET = 0.1;

export type EnrichProgress = (row: LeadEnrichment) => void | Promise<void>;

export type EnrichTimings = {
  serper_ms: number;
  crawl_ms: number;
  pages: number;
  osm_ms: number;
  progress_ms: number;
};

function elapsed(started: number): number {
  return Date.now() - started;
}

export async function respectRateLimit(
  host: string,
  minGapMs = 2000,
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

async function fetchPage(
  url: string,
  minGapMs = 2000,
): Promise<{ html: string; status: number; finalUrl: string } | null> {
  const u = new URL(url);
  if (!(await allowedByRobots(u.origin, u.pathname))) return null;
  await respectRateLimit(u.host, minGapMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": GRID_USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 1.5 * 1024 * 1024) return null;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    return { html, status: res.status, finalUrl: res.url };
  } catch {
    return null;
  }
}

export function domainFromEmail(email: string | null): string | null {
  if (!email || !email.includes("@")) return null;
  if (isFreeEmail(email) || hasAccountantDomainHint(email)) return null;
  const host = email.split("@")[1]?.toLowerCase();
  if (!host) return null;
  return host;
}

export async function serperSearch(query: string): Promise<string | null> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "br", hl: "pt-br", num: 5 }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { organic?: Array<{ link?: string }> };
  for (const item of json.organic ?? []) {
    const link = item.link;
    if (!link || isDirectoryUrl(link)) continue;
    try {
      return new URL(link).origin;
    } catch {
      continue;
    }
  }
  return null;
}

export type CascadeCompany = {
  establishment: Establishment;
  company: Company;
  municipioNome: string;
  sharedCount: number;
  sharedVerdict: SharedPhoneVerdict;
  scoreProfile: "b2c_local" | "b2b_industria";
  qsaNomes?: string[];
};

type SitePhone = NonNullable<ReturnType<typeof extractNormalizedPhones>>[number];

function buildPhoneEvidences(input: {
  domainStatus: DomainStatus;
  receita: ReturnType<typeof normalizePhoneBR>;
  sitePhones: SitePhone[];
  sharedCount: number;
  sharedVerdict: SharedPhoneVerdict;
}): PhoneEvidence[] {
  const derived = deriveSeal({
    domainStatus: input.domainStatus,
    receita: input.receita,
    sitePhones: input.sitePhones,
    sharedCount: input.sharedCount,
    sharedVerdict: input.sharedVerdict,
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
    pushEvidence(
      input.receita,
      onSite ? ["receita", "site_tel"] : ["receita"],
      false,
      onSite ? "CONFIRMADO" : derived.principalIsSite ? undefined : derived.seal,
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

  evidences.sort((a, b) => {
    const rank: Record<string, number> = {
      CONFIRMADO: 5,
      ATUALIZADO: 4,
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
  const extracted = confirmed
    ? extractContacts(input.html, input.ddd1)
    : { phones: [], emails: [], socials: {} };
  return {
    tech,
    emails: extracted.emails.map((valor) => ({
      valor,
      fonte: "site_mailto",
      coletado_em: input.collectedAt,
    })),
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
): Promise<{ row: LeadEnrichment; timings: EnrichTimings }> {
  const now = new Date();
  const collected_at = now.toISOString();
  const expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const est = input.establishment;
  const fonte: LeadEnrichment["fonte"] = {};

  let domain: string | null = cachedDomain?.domain ?? null;
  let domain_status: DomainStatus =
    (cachedDomain?.status as DomainStatus) ?? "nao_encontrado";
  let http_status: number | null = null;
  let combinedHtml = "";
  let finalUrl = "";
  const timings: EnrichTimings = {
    serper_ms: 0,
    crawl_ms: 0,
    pages: 0,
    osm_ms: 0,
    progress_ms: 0,
  };

  if (!domain) {
    domain = domainFromEmail(est.email);
    if (domain) {
      fonte.domain = { fonte: "email_receita", coletado_em: collected_at };
    }
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
    } = {},
  ): LeadEnrichment => {
    const sitePhones = extras.sitePhones ?? [];
    const receita = normalizePhoneBR(
      `${est.ddd1 ?? ""}${est.telefone1 ?? ""}`,
      est.ddd1,
    );
    const phones = buildPhoneEvidences({
      domainStatus: domain_status,
      receita,
      sitePhones,
      sharedCount: input.sharedCount,
      sharedVerdict: input.sharedVerdict,
    });
    const tech = extras.tech ?? detectTech("", "");
    const row: LeadEnrichment = {
      cnpj: est.cnpj,
      domain: domain ? domain.replace(/^https?:\/\//, "") : null,
      domain_status,
      http_status,
      phones,
      emails: extras.emails ?? [],
      whatsapp:
        phones.find((e) => e.isWhatsApp)?.e164?.replace("+", "") ?? null,
      socials: extras.socials ?? {},
      tech,
      freshness: extras.freshness ?? {},
      osm: null,
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
    const t = Date.now();
    await onProgress?.(row);
    timings.progress_ms += elapsed(t);
    return row;
  };

  await emit(assemble("domain", { people: null }));

  if (!domain) {
    const q = `"${input.company.razao_social}" ${est.nome_fantasia ?? ""} ${input.municipioNome} ${est.uf}`;
    const serperStarted = Date.now();
    const found = await serperSearch(q.trim());
    timings.serper_ms = elapsed(serperStarted);
    if (found) {
      domain = new URL(found).host;
      fonte.domain = { fonte: "serper", coletado_em: collected_at };
      domain_status = "nao_confirmado";
      await emit(assemble("domain", { people: null }));
    }
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

  if (domain) {
    const origin = domain.startsWith("http") ? domain : `https://${domain}`;
    let pages = 0;
    let confirmed = false;
    let homeEmitted = false;
    const crawlPaths = [HOME_PATH, ...INNER_PATHS];
    const crawlStarted = Date.now();

    for (const path of crawlPaths) {
      if (pages >= 5) break;
      const page = await fetchPage(
        `${origin}${path}`,
        path === HOME_PATH ? 2000 : INNER_PAGE_GAP_MS,
      );
      pages += 1;
      if (!page) {
        if (path === "/" && !homeEmitted) {
          await emit(assemble("home", { people: [] }));
          homeEmitted = true;
        }
        continue;
      }
      http_status = page.status;
      finalUrl = page.finalUrl;
      combinedHtml += `\n${page.html}`;
      if (
        confirmDomainOwnership({
          html: page.html,
          cnpj: est.cnpj,
          razaoSocial: input.company.razao_social,
          nomeFantasia: est.nome_fantasia,
          municipio: input.municipioNome,
        })
      ) {
        confirmed = true;
      }
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

      if (!homeEmitted) {
        await emit(
          assemble("home", {
            tech: snap.tech,
            emails: snap.emails,
            socials: snap.socials,
            sitePhones: snap.sitePhones,
            freshness: snap.freshness,
            people: snap.people,
          }),
        );
        homeEmitted = true;
      }

      if (confirmed) break;
    }
    timings.pages = pages;
    timings.crawl_ms = elapsed(crawlStarted);

    const visibleLen = combinedHtml.replace(/<[^>]+>/g, "").trim().length;
    if (visibleLen < 500) {
      const ratio = playwrightBudgetUsed / Math.max(pages, 1);
      if (ratio < PLAYWRIGHT_BUDGET) {
        playwrightBudgetUsed += 1;
      }
    }

    domain_status = confirmed ? "confirmado" : domain ? "nao_confirmado" : "nao_encontrado";
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

  await emit(
    assemble("site", {
      tech: snap.tech,
      emails: snap.emails,
      socials: snap.socials,
      sitePhones: snap.sitePhones,
      freshness: snap.freshness,
      people: snap.people,
    }),
  );

  const row = await emit(
    assemble("complete", {
      tech: snap.tech,
      emails: snap.emails,
      socials: snap.socials,
      sitePhones: snap.sitePhones,
      freshness: snap.freshness,
      people: snap.people,
    }),
  );
  return { row, timings };
}
