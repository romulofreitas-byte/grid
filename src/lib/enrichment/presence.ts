import {
  brandTokenHits,
  distinctiveTokens,
  presenceBrandTokens,
} from "@/lib/enrichment/confirm-domain";
import { isDirectoryUrl } from "@/lib/enrichment/directory-blocklist";
import {
  isMapsUrl,
  mapsCidUrl,
  searchableCompanyName,
} from "@/lib/enrichment/company-name";
import { parseInstagramHandle } from "@/lib/instagram";
import { phonesMatch } from "@/lib/phone";
import type {
  GmbCard,
  GmbCardCheck,
  GmbListing,
  GmbMatchBy,
  GmbPhoneVsReceita,
  SharedPhoneVerdict,
} from "@/lib/types";
import {
  GMB_CARD_CHECKS,
  gmbCardKindFromScore,
  gmbNoneListing,
} from "@/lib/types";

export type OrganicHit = {
  link: string;
  title: string;
  snippet?: string;
  /** Knowledge Graph field — provenance `serper_kg`. */
  via?: "kg";
};

export type MapsPlace = {
  title: string;
  address?: string;
  phoneNumber?: string;
  website?: string;
  link?: string;
  cid?: string;
  rating?: number;
  ratingCount?: number;
  category?: string;
  openingHours?: unknown;
  thumbnailUrl?: string;
};

export type GmbSearchInput = {
  nomeFantasia: string | null;
  razaoSocial: string;
  municipio: string;
  uf: string;
  logradouro?: string | null;
  numero?: string | null;
  phones?: Array<{ ddd: string | null; telefone: string | null }>;
  /** Skip street in Maps queries — Receita address is the office, not the shop. */
  sharedVerdict?: SharedPhoneVerdict;
};

export type SocialPlatform = "instagram" | "facebook" | "linkedin" | "youtube";

/** Minimum distinctive-token hits in title/snippet/host to accept a domain candidate. */
export const DOMAIN_SCORE_MIN = 1;
/** Organic window — school/CNPJ directories often occupy the first handful. */
export const SERPER_ORGANIC_NUM = 10;

const SOCIAL_HOST: Record<SocialPlatform, string> = {
  instagram: "instagram.com",
  facebook: "facebook.com",
  linkedin: "linkedin.com",
  youtube: "youtube.com",
};

function serperKey(): string | null {
  return process.env.SERPER_API_KEY ?? null;
}

const STREET_PREFIX =
  /^(r|rua|av|ave|avenida|travessa|alameda|al|praca|pca|rodovia|rod|estrada|est|tv)\.?\s+/i;

const SOCIAL_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|facebook\.com|fb\.com|linkedin\.com|youtube\.com|youtu\.be)\/[^\s"'<>]+/gi;

function stripAccents(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function withHttp(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, "")}`;
}

/** Maps listing URL only — never the business website. */
export function mapsPlaceListingUrl(place: MapsPlace): string {
  if (place.cid) return mapsCidUrl(place.cid);
  if (place.link) {
    const href = withHttp(place.link);
    if (isMapsUrl(href)) return href;
  }
  return "";
}

export function websiteHostFromMapsPlace(place: MapsPlace): string | null {
  if (!mapsWebsiteOnCard(place.website)) return null;
  try {
    return new URL(withHttp(place.website!))
      .hostname.replace(/^www\./i, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

function receitaHasPhone(
  phones: Array<{ ddd: string | null; telefone: string | null }> = [],
): boolean {
  return phones.some((phone) =>
    Boolean(`${phone.ddd ?? ""}${phone.telefone ?? ""}`.replace(/\D/g, "")),
  );
}

export function mapsPhoneVsReceita(
  place: MapsPlace,
  input: GmbSearchInput,
  matched: boolean,
): GmbPhoneVsReceita | null {
  if (!matched) return null;
  if (input.sharedVerdict === "contabilidade") return "ignorado_compartilhado";
  const mapsHas = Boolean(place.phoneNumber?.trim());
  const receitaHas = receitaHasPhone(input.phones);
  if (mapsHas && receitaHas) {
    return mapsPhoneMatchesReceita(place.phoneNumber, input.phones)
      ? "igual"
      : "diferente";
  }
  if (mapsHas) return "so_maps";
  if (receitaHas) return "so_receita";
  return null;
}

function mapsIdentityLocked(match_by: GmbMatchBy[]): boolean {
  if (match_by.includes("phone")) return true;
  return match_by.includes("title") && match_by.includes("address");
}

function mapsTitleCityHit(match_by: GmbMatchBy[]): boolean {
  return match_by.includes("title") && match_by.includes("city");
}

export function mapsPhoneMatchesReceita(
  mapsPhone: string | undefined,
  phones: Array<{ ddd: string | null; telefone: string | null }> = [],
): boolean {
  if (!mapsPhone?.trim()) return false;
  for (const phone of phones) {
    const raw = `${phone.ddd ?? ""}${phone.telefone ?? ""}`;
    if (!raw.replace(/\D/g, "")) continue;
    if (phonesMatch(mapsPhone, raw, phone.ddd)) return true;
  }
  return false;
}

export function mapsAddressMatchesReceita(
  mapsAddress: string | undefined,
  receita: {
    logradouro?: string | null;
    numero?: string | null;
    municipio: string;
    uf: string;
  },
): boolean {
  if (!mapsAddress?.trim()) return false;
  const hay = stripAccents(mapsAddress);
  const numero = (receita.numero ?? "").replace(/\D/g, "");
  if (!numero) return false;
  const log = stripAccents(receita.logradouro ?? "")
    .replace(STREET_PREFIX, "")
    .trim();
  if (log.length < 4) return false;
  if (!hay.includes(log)) return false;
  const numRe = new RegExp(`(?:^|\\D)${numero}(?:\\D|$)`);
  if (!numRe.test(hay)) return false;
  const mun = stripAccents(receita.municipio);
  const uf = stripAccents(receita.uf);
  if (mun.length >= 3 && hay.includes(mun)) return true;
  if (uf.length === 2 && hay.includes(uf)) return true;
  return false;
}

/** Municipality in Maps address or title — UF alone is too weak. */
export function mapsCityMatchesReceita(
  mapsText: string | undefined,
  receita: { municipio: string; uf: string },
): boolean {
  if (!mapsText?.trim()) return false;
  const hay = stripAccents(mapsText);
  const mun = stripAccents(receita.municipio);
  return mun.length >= 3 && hay.includes(mun);
}

function mapsPlaceRank(
  matchScore: number,
  place: MapsPlace,
): [number, number, number] {
  const card = gmbCardFromPlace(place);
  return [matchScore, card.score, card.ratingCount ?? 0];
}

function mapsPlaceBetter(
  candidate: { score: number; place: MapsPlace },
  current: { score: number; place: MapsPlace },
): boolean {
  const a = mapsPlaceRank(candidate.score, candidate.place);
  const b = mapsPlaceRank(current.score, current.place);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

export function scoreMapsPlace(
  place: MapsPlace,
  input: GmbSearchInput,
): { score: number; match_by: GmbMatchBy[]; matched: boolean } {
  const match_by: GmbMatchBy[] = [];
  let score = 0;
  const title = titleMatchesCompany(
    place.title,
    input.razaoSocial,
    input.nomeFantasia,
    input.municipio,
  );
  const strongTitle =
    title &&
    presenceBrandTokens(
      input.razaoSocial,
      input.nomeFantasia,
      input.municipio,
    ).length > 0;
  const cityHay = [place.address, place.title].filter(Boolean).join(" ");
  const city = mapsCityMatchesReceita(cityHay, {
    municipio: input.municipio,
    uf: input.uf,
  });
  const address = mapsAddressMatchesReceita(place.address, {
    logradouro: input.logradouro,
    numero: input.numero,
    municipio: input.municipio,
    uf: input.uf,
  });
  const phone =
    input.sharedVerdict !== "contabilidade" &&
    mapsPhoneMatchesReceita(place.phoneNumber, input.phones);

  if (title) {
    match_by.push("title");
    score += 2;
  }
  if (address) {
    match_by.push("address");
    score += 3;
  } else if (city) {
    match_by.push("city");
    score += 1;
  }
  if (phone) {
    match_by.push("phone");
    score += 4;
  }

  const matched = Boolean(phone || (title && address) || (strongTitle && city));
  return { score, match_by, matched };
}

export function pickBestMapsPlace(
  places: MapsPlace[],
  input: GmbSearchInput,
): { place: MapsPlace; match_by: GmbMatchBy[]; score: number } | null {
  const scored: Array<{
    place: MapsPlace;
    match_by: GmbMatchBy[];
    score: number;
    matched: boolean;
  }> = [];
  for (const place of places) {
    if (!place.title) continue;
    const result = scoreMapsPlace(place, input);
    scored.push({ place, ...result });
  }

  const identity = scored.filter(
    (item) => item.matched && mapsIdentityLocked(item.match_by),
  );
  if (identity.length > 0) {
    return pickRankedMapsPlace(identity);
  }

  const brandCity = scored.filter(
    (item) => item.matched && !mapsIdentityLocked(item.match_by),
  );
  if (brandCity.length === 1) return pickRankedMapsPlace(brandCity);
  return null;
}

function pickRankedMapsPlace(
  items: Array<{ place: MapsPlace; match_by: GmbMatchBy[]; score: number }>,
): { place: MapsPlace; match_by: GmbMatchBy[]; score: number } {
  let best = items[0];
  for (let i = 1; i < items.length; i++) {
    if (mapsPlaceBetter(items[i], best)) best = items[i];
  }
  return best;
}

export function countTitleCityPlaces(
  places: MapsPlace[],
  input: GmbSearchInput,
): number {
  let count = 0;
  for (const place of places) {
    if (!place.title) continue;
    const scored = scoreMapsPlace(place, input);
    if (mapsTitleCityHit(scored.match_by)) count += 1;
  }
  return count;
}

/** Brand+city card that is not identity-locked to this CNPJ (chain / weak brand). */
export function pickBestCandidateMapsPlace(
  places: MapsPlace[],
  input: GmbSearchInput,
): {
  place: MapsPlace;
  match_by: GmbMatchBy[];
  score: number;
  count: number;
} | null {
  const hits: Array<{
    place: MapsPlace;
    match_by: GmbMatchBy[];
    score: number;
  }> = [];
  for (const place of places) {
    if (!place.title) continue;
    const scored = scoreMapsPlace(place, input);
    if (!mapsTitleCityHit(scored.match_by)) continue;
    if (mapsIdentityLocked(scored.match_by)) continue;
    hits.push({ place, match_by: scored.match_by, score: scored.score });
  }
  if (hits.length === 0) return null;
  return { ...pickRankedMapsPlace(hits), count: hits.length };
}

export function gmbListingFromPlace(
  place: MapsPlace,
  input: GmbSearchInput,
  opts: {
    matched: boolean;
    match_by: GmbMatchBy[];
    status: "matched" | "candidate";
    candidates_in_city?: number | null;
  },
): GmbListing {
  const card = gmbCardFromPlace(place);
  return {
    name: place.title,
    url: mapsPlaceListingUrl(place),
    matched: opts.matched,
    match_by: opts.match_by,
    cid: place.cid ?? null,
    card,
    status: opts.status,
    website_host: websiteHostFromMapsPlace(place),
    phone_vs_receita: mapsPhoneVsReceita(place, input, opts.matched),
    kind: gmbCardKindFromScore(card.score),
    candidates_in_city: opts.candidates_in_city ?? null,
  };
}

export function resolveGmbListing(
  places: MapsPlace[],
  input: GmbSearchInput,
): GmbListing {
  const matched = pickBestMapsPlace(places, input);
  const cityHits = countTitleCityPlaces(places, input);
  if (matched) {
    return gmbListingFromPlace(matched.place, input, {
      matched: true,
      match_by: matched.match_by,
      status: "matched",
      candidates_in_city: cityHits || 1,
    });
  }
  const candidate = pickBestCandidateMapsPlace(places, input);
  if (candidate) {
    return gmbListingFromPlace(candidate.place, input, {
      matched: false,
      match_by: candidate.match_by,
      status: "candidate",
      candidates_in_city: candidate.count,
    });
  }
  return gmbNoneListing();
}

function listingCardBetter(candidate: GmbListing, current: GmbListing): boolean {
  const a = [candidate.card?.score ?? 0, candidate.card?.ratingCount ?? 0];
  const b = [current.card?.score ?? 0, current.card?.ratingCount ?? 0];
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

export function gmbSearchQuery(
  input: GmbSearchInput,
  opts?: { quoted?: boolean; includeStreet?: boolean },
): string {
  const name = searchableCompanyName(input.nomeFantasia, input.razaoSocial);
  const quoted = opts?.quoted !== false;
  const namePart = name ? (quoted ? `"${name}"` : name) : "";
  const street =
    opts?.includeStreet === true
      ? [input.logradouro, input.numero]
          .map((part) => part?.trim())
          .filter(Boolean)
          .join(", ")
      : "";
  const place = [input.municipio, input.uf].filter(Boolean).join(" ");
  return [namePart, street, place].filter(Boolean).join(" ").trim();
}

/** City first; street only when the Receita phone is not the accountant's. */
export function gmbSearchQueryList(input: GmbSearchInput): string[] {
  const skipStreet = input.sharedVerdict === "contabilidade";
  const list: string[] = [];
  const push = (q: string) => {
    if (q && !list.includes(q)) list.push(q);
  };
  push(gmbSearchQuery(input, { quoted: true, includeStreet: false }));
  if (!skipStreet) {
    push(gmbSearchQuery(input, { quoted: true, includeStreet: true }));
  }
  push(gmbSearchQuery(input, { quoted: false, includeStreet: false }));
  return list;
}

function pushHit(
  hits: OrganicHit[],
  seen: Set<string>,
  link: string | undefined,
  title: string,
  snippet?: string,
  via?: "kg",
): void {
  if (!link) return;
  const href = withHttp(link).replace(/[.,;:!?)]+$/, "");
  try {
    new URL(href);
  } catch {
    return;
  }
  const key = href.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  hits.push({ link: href, title, snippet, via });
}

function harvestUrlsFromText(text: string | undefined): string[] {
  if (!text) return [];
  const found: string[] = [];
  const re = new RegExp(SOCIAL_URL_RE.source, SOCIAL_URL_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    found.push(withHttp(m[0].replace(/[.,;:!?)]+$/, "")));
  }
  return found;
}

export function socialsFromHits(
  hits: OrganicHit[],
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
  blockedLabels: string[] = [],
  allowWeakBrand = false,
): Partial<Record<SocialPlatform, string>> {
  const out: Partial<Record<SocialPlatform, string>> = {};
  for (const platform of Object.keys(SOCIAL_HOST) as SocialPlatform[]) {
    const found = pickSocialHit(
      hits,
      SOCIAL_HOST[platform],
      razaoSocial,
      nomeFantasia,
      municipio,
      blockedLabels,
      allowWeakBrand,
    );
    if (found) out[platform] = found;
  }
  return out;
}

export function socialFonteFromHit(
  hits: OrganicHit[],
  url: string,
): "serper" | "serper_kg" {
  const hit = hits.find((h) => h.link === url);
  return hit?.via === "kg" ? "serper_kg" : "serper";
}

/** Path slug / handle from a social URL (instagram, facebook, etc.). */
export function socialHandleFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host.includes("instagram.com")) {
      return parseInstagramHandle(url);
    }
    const parts = u.pathname.split("/").filter(Boolean);
    if (host.includes("facebook.com") || host.includes("fb.com")) {
      const skip = new Set(["pages", "profile.php", "people", "public"]);
      const candidate = parts.find((p) => !skip.has(p.toLowerCase()));
      return candidate?.replace(/[^a-zA-Z0-9._]/g, "") || null;
    }
    if (host.includes("linkedin.com")) {
      const idx = parts.findIndex((p) => p === "company" || p === "in");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      return parts[0] ?? null;
    }
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      const at = parts.find((p) => p.startsWith("@"));
      if (at) return at.slice(1);
      const ch = parts.findIndex((p) => p === "channel" || p === "c" || p === "user");
      if (ch >= 0 && parts[ch + 1]) return parts[ch + 1];
      return parts[0] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Accept a search hit only when a *strong* brand token appears in the title
 * or in the profile handle. Weak-only names (e.g. "Distribuidora Silva") never
 * match from search — they require a confirmed site link.
 */
export function socialHitMatchesBrand(
  hit: OrganicHit,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
): boolean {
  const strong = presenceBrandTokens(razaoSocial, nomeFantasia, municipio);
  if (strong.length === 0) return false;

  const handle = socialHandleFromUrl(hit.link)?.toLowerCase() ?? "";
  const handleCompact = handle.replace(/[^a-z0-9]/g, "");
  const hay = stripAccents(`${hit.title} ${hit.snippet ?? ""}`);

  return strong.some((t) => {
    if (hay.includes(t)) return true;
    // Handle must contain the full brand token (not the reverse — avoids gene⊂genesis).
    if (handleCompact.length >= 4 && handleCompact.includes(t)) return true;
    return false;
  });
}

/** After Maps×Receita corroboration, weak brands may match on distinctive tokens. */
export function socialHitMatchesLoose(
  hit: OrganicHit,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
): boolean {
  if (socialHitMatchesBrand(hit, razaoSocial, nomeFantasia, municipio)) {
    return true;
  }
  if (
    titleMatchesCompany(
      `${hit.title} ${hit.snippet ?? ""}`,
      razaoSocial,
      nomeFantasia,
      municipio,
    )
  ) {
    return true;
  }
  const tokens = distinctiveTokens(razaoSocial, nomeFantasia, municipio).filter(
    (t) => t.length >= 4,
  );
  const handle = socialHandleFromUrl(hit.link)?.toLowerCase() ?? "";
  const handleCompact = handle.replace(/[^a-z0-9]/g, "");
  const handleHits = tokens.filter((t) => handleCompact.includes(t));
  return handleHits.length >= 2;
}

/** GMB / Maps title: strong token, or ≥2 distinctive tokens when the brand is weak-only. */
export function titleMatchesCompany(
  title: string,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
): boolean {
  const strong = presenceBrandTokens(razaoSocial, nomeFantasia, municipio);
  const hay = stripAccents(title);
  if (strong.length > 0) {
    return strong.some((t) => hay.includes(t));
  }
  const tokens = distinctiveTokens(razaoSocial, nomeFantasia, municipio);
  if (tokens.length === 0) return false;
  const hits = tokens.filter((t) => hay.includes(t));
  return hits.length >= Math.min(2, tokens.length) && hits.length >= 2;
}

export function hostBrandTokenHits(
  link: string,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
): number {
  const strong = presenceBrandTokens(razaoSocial, nomeFantasia, municipio);
  if (strong.length === 0) return 0;
  let host = "";
  try {
    host = new URL(withHttp(link)).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return 0;
  }
  const label = stripAccents(host.split(".")[0] ?? "").replace(/[^a-z0-9]/g, "");
  if (label.length < 4) return 0;
  return strong.filter((t) => t.length >= 4 && label.includes(t)).length;
}

function homepageBonus(link: string): number {
  try {
    const path = new URL(withHttp(link)).pathname.replace(/\/+$/, "") || "/";
    return path === "/" ? 1 : 0;
  } catch {
    return 0;
  }
}

export function scoreDomainHit(
  hit: OrganicHit,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
): number {
  const blob = `${hit.title} ${hit.snippet ?? ""}`;
  const strong = presenceBrandTokens(razaoSocial, nomeFantasia, municipio);
  const hay = stripAccents(blob);
  let textScore = 0;
  if (strong.length > 0) {
    textScore = strong.filter((t) => hay.includes(t)).length;
  } else {
    // Weak-only brands: require ≥2 distinctive tokens to propose a domain.
    const hits = brandTokenHits(blob, razaoSocial, nomeFantasia, municipio);
    textScore = hits >= 2 ? hits : 0;
  }
  const hostScore = hostBrandTokenHits(
    hit.link,
    razaoSocial,
    nomeFantasia,
    municipio,
  );
  if (textScore + hostScore === 0) return 0;
  const kgBonus = hit.via === "kg" ? 2 : 0;
  return textScore + hostScore * 2 + kgBonus + homepageBonus(hit.link);
}

/**
 * Pick the best organic domain candidate by brand-token overlap.
 * Returns null when no hit meets DOMAIN_SCORE_MIN.
 */
export function pickBestDomainHit(
  hits: OrganicHit[],
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
  excludeHosts: string[] = [],
): OrganicHit | null {
  const blocked = new Set(
    excludeHosts.map((h) =>
      h.replace(/^https?:\/\//, "").replace(/^www\./, "").toLowerCase(),
    ),
  );
  let best: { hit: OrganicHit; score: number } | null = null;
  for (const hit of hits) {
    if (isDirectoryUrl(hit.link)) continue;
    try {
      const host = new URL(hit.link).host
        .toLowerCase()
        .replace(/^www\./, "");
      if (blocked.has(host)) continue;
    } catch {
      continue;
    }
    const score = scoreDomainHit(hit, razaoSocial, nomeFantasia, municipio);
    if (score < DOMAIN_SCORE_MIN) continue;
    if (!best || score > best.score) best = { hit, score };
  }
  return best?.hit ?? null;
}

export function hitsFromSerperJson(json: {
  organic?: Array<{
    link?: string;
    title?: string;
    snippet?: string;
    sitelinks?: Array<{ link?: string; title?: string }>;
  }>;
  knowledgeGraph?: {
    title?: string;
    website?: string;
    description?: string;
    attributes?: Record<string, string>;
  };
}): OrganicHit[] {
  const hits: OrganicHit[] = [];
  const seen = new Set<string>();
  const kg = json.knowledgeGraph;
  if (kg?.website) {
    pushHit(hits, seen, kg.website, kg.title ?? "", kg.description, "kg");
  }
  if (kg?.attributes) {
    for (const [label, value] of Object.entries(kg.attributes)) {
      for (const url of harvestUrlsFromText(value)) {
        pushHit(hits, seen, url, `${kg.title ?? ""} ${label}`, value, "kg");
      }
      if (/^https?:\/\//i.test(value.trim()) || /\.(com|br)\//i.test(value)) {
        pushHit(hits, seen, value, `${kg.title ?? ""} ${label}`, value, "kg");
      }
    }
  }
  for (const item of json.organic ?? []) {
    pushHit(hits, seen, item.link, item.title ?? "", item.snippet);
    for (const sitelink of item.sitelinks ?? []) {
      pushHit(
        hits,
        seen,
        sitelink.link,
        sitelink.title ?? item.title ?? "",
        item.snippet,
      );
    }
    for (const url of harvestUrlsFromText(
      `${item.title ?? ""} ${item.snippet ?? ""}`,
    )) {
      pushHit(hits, seen, url, item.title ?? "", item.snippet);
    }
  }
  return hits;
}

export async function serperOrganic(
  query: string,
  num = SERPER_ORGANIC_NUM,
): Promise<OrganicHit[]> {
  const key = serperKey();
  if (!key) return [];
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "br", hl: "pt-br", num }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.warn(
      JSON.stringify({
        event: "serper_error",
        kind: "search",
        status: res.status,
      }),
    );
    return [];
  }
  const json = (await res.json()) as Parameters<typeof hitsFromSerperJson>[0];
  return hitsFromSerperJson(json);
}

export async function serperMaps(query: string): Promise<MapsPlace[]> {
  const key = serperKey();
  if (!key) return [];
  const res = await fetch("https://google.serper.dev/maps", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "br", hl: "pt-br" }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.warn(
      JSON.stringify({
        event: "serper_error",
        kind: "maps",
        status: res.status,
      }),
    );
    return [];
  }
  const json = (await res.json()) as {
    places?: Array<Record<string, unknown>>;
  };
  const places: MapsPlace[] = [];
  for (const place of json.places ?? []) {
    const parsed = mapsPlaceFromSerper(place);
    if (parsed) places.push(parsed);
  }
  return places;
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function firstPhotoUrl(value: unknown): string | undefined {
  const direct = asTrimmedString(value);
  if (direct) return direct;
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const first = value[0];
  if (typeof first === "string") return asTrimmedString(first);
  if (first && typeof first === "object") {
    const rec = first as Record<string, unknown>;
    return (
      asTrimmedString(rec.thumbnailUrl) ||
      asTrimmedString(rec.imageUrl) ||
      asTrimmedString(rec.url)
    );
  }
  return undefined;
}

function mapsPlaceFromSerper(
  place: Record<string, unknown>,
): MapsPlace | null {
  const title = asTrimmedString(place.title);
  if (!title) return null;
  const category =
    asTrimmedString(place.category) ||
    asTrimmedString(place.type) ||
    (Array.isArray(place.types)
      ? asTrimmedString(place.types[0])
      : undefined);
  return {
    title,
    address: asTrimmedString(place.address),
    phoneNumber: asTrimmedString(place.phoneNumber),
    website: asTrimmedString(place.website),
    link: asTrimmedString(place.link),
    cid:
      asTrimmedString(place.cid) ??
      (typeof place.cid === "number" && Number.isFinite(place.cid)
        ? String(place.cid)
        : undefined),
    rating: asFiniteNumber(place.rating),
    ratingCount: asFiniteNumber(
      place.ratingCount ?? place.reviews ?? place.reviewCount,
    ),
    category,
    openingHours: place.openingHours ?? place.hours ?? place.opening_hours,
    thumbnailUrl:
      firstPhotoUrl(place.thumbnailUrl) ||
      firstPhotoUrl(place.thumbnail) ||
      firstPhotoUrl(place.imageUrl) ||
      firstPhotoUrl(place.photos),
  };
}

function mapsWebsiteOnCard(website: string | undefined): boolean {
  if (!website?.trim()) return false;
  try {
    const host = new URL(withHttp(website)).hostname.toLowerCase();
    if (host.includes("google.com") || host.includes("maps.google")) {
      return false;
    }
    return !isDirectoryUrl(website);
  } catch {
    return false;
  }
}

function mapsHoursOnCard(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) {
    return value.some((item) => mapsHoursOnCard(item));
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) =>
      mapsHoursOnCard(item),
    );
  }
  return false;
}

/** Checklist of the public Maps card. Does not store address, hours text, or reviews. */
export function gmbCardFromPlace(place: MapsPlace): GmbCard {
  const filled: GmbCardCheck[] = [];
  if (place.phoneNumber?.trim()) filled.push("phone");
  if (mapsWebsiteOnCard(place.website)) filled.push("website");
  if (mapsHoursOnCard(place.openingHours)) filled.push("hours");
  if (place.thumbnailUrl?.trim()) filled.push("photo");
  const rating = asFiniteNumber(place.rating) ?? null;
  const ratingCount = asFiniteNumber(place.ratingCount) ?? null;
  if ((ratingCount != null && ratingCount > 0) || (rating != null && rating > 0)) {
    filled.push("reviews");
  }
  return {
    filled: GMB_CARD_CHECKS.filter((check) => filled.includes(check)),
    score: filled.length,
    rating,
    ratingCount,
    category: place.category?.trim() || null,
  };
}

/** Only accept a social hit when title/handle correlates with a strong brand token. */
export function pickSocialHit(
  hits: OrganicHit[],
  host: string,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
  blockedLabels: string[] = [],
  allowWeakBrand = false,
): string | null {
  const blocked = blockedLabels
    .map((l) => l.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((l) => l.length >= 4);
  const matches = allowWeakBrand
    ? socialHitMatchesLoose
    : socialHitMatchesBrand;
  for (const hit of hits) {
    try {
      const hostname = new URL(hit.link).hostname.toLowerCase();
      if (!hostname.includes(host)) continue;
    } catch {
      continue;
    }
    const handle = socialHandleFromUrl(hit.link)?.toLowerCase() ?? "";
    const handleCompact = handle.replace(/[^a-z0-9]/g, "");
    if (
      blocked.some(
        (label) =>
          handleCompact.includes(label) ||
          stripAccents(`${hit.title} ${hit.snippet ?? ""}`).includes(label),
      )
    ) {
      continue;
    }
    if (matches(hit, razaoSocial, nomeFantasia, municipio)) {
      return hit.link;
    }
  }
  return null;
}

export function presenceQuery(
  platform: keyof typeof SOCIAL_HOST | "gmb",
  nomeFantasia: string | null,
  razaoSocial: string,
  municipio: string,
  uf: string,
  brandOverride?: string | null,
  mode: "site" | "web" = "site",
): string {
  const name =
    brandOverride?.trim() ||
    searchableCompanyName(nomeFantasia, razaoSocial);
  const place = [municipio, uf].filter(Boolean).join(" ");
  if (platform === "gmb") {
    return `"${name}" ${place}`.trim();
  }
  if (mode === "web") {
    const label =
      platform === "instagram"
        ? "Instagram"
        : platform === "facebook"
          ? "Facebook"
          : platform === "linkedin"
            ? "LinkedIn"
            : "YouTube";
    return `"${name}" ${label} ${place}`.trim();
  }
  return `site:${SOCIAL_HOST[platform]} "${name}" ${place}`.trim();
}

export async function searchSocialProfile(input: {
  platform: keyof typeof SOCIAL_HOST;
  nomeFantasia: string | null;
  razaoSocial: string;
  municipio: string;
  uf: string;
  brandOverride?: string | null;
  /** Labels from provider/accountant domains — never accept as company social. */
  blockedLabels?: string[];
  /** Maps×Receita corroborated — allow distinctive-token match for weak brands. */
  allowWeakBrand?: boolean;
  /** Drop the site: operator (Knowledge Graph / web results). */
  webQuery?: boolean;
}): Promise<string | null> {
  const strong = presenceBrandTokens(
    input.razaoSocial,
    input.brandOverride?.trim() || input.nomeFantasia,
    input.municipio,
  );
  const distinctive = distinctiveTokens(
    input.razaoSocial,
    input.brandOverride?.trim() || input.nomeFantasia,
    input.municipio,
  );
  // No distinctive brand signal → refuse search (avoid @sagem / Silva false positives).
  if (strong.length === 0 && !input.allowWeakBrand) return null;
  if (input.allowWeakBrand && strong.length === 0 && distinctive.length < 2) {
    return null;
  }

  const q = presenceQuery(
    input.platform,
    input.nomeFantasia,
    input.razaoSocial,
    input.municipio,
    input.uf,
    input.brandOverride,
    input.webQuery ? "web" : "site",
  );
  const hits = await serperOrganic(q);
  return pickSocialHit(
    hits,
    SOCIAL_HOST[input.platform],
    input.razaoSocial,
    input.brandOverride?.trim() || input.nomeFantasia,
    input.municipio,
    input.blockedLabels,
    input.allowWeakBrand === true,
  );
}

export async function searchGmb(input: GmbSearchInput): Promise<GmbListing> {
  const queries = gmbSearchQueryList(input);
  if (queries.length === 0) return gmbNoneListing();

  const take = async (query: string): Promise<GmbListing> =>
    resolveGmbListing(await serperMaps(query), input);

  const first = await take(queries[0]);
  if (first.matched || first.status === "matched") return first;

  const rest = queries.slice(1);
  const skipStreet = input.sharedVerdict === "contabilidade";
  const streetQuery = !skipStreet && rest.length > 0 ? rest[0] : null;

  if (first.status === "candidate") {
    if (!streetQuery) return first;
    const street = await take(streetQuery);
    if (street.matched || street.status === "matched") return street;
    if (street.status === "candidate" && listingCardBetter(street, first)) {
      return street;
    }
    return first;
  }

  if (rest.length === 0) return gmbNoneListing();
  const extra = await Promise.all(rest.map((query) => take(query)));
  for (const listing of extra) {
    if (listing.matched || listing.status === "matched") return listing;
  }
  let best: GmbListing | null = null;
  for (const listing of extra) {
    if (listing.status !== "candidate") continue;
    if (!best || listingCardBetter(listing, best)) best = listing;
  }
  return best ?? gmbNoneListing();
}

/** Extract a website host from a matched GMB listing (not maps.google). */
export function domainFromGmb(listing: GmbListing | null): string | null {
  if (!listing?.matched) return null;
  const stored = listing.website_host?.trim().toLowerCase().replace(/^www\./, "");
  if (
    stored &&
    !stored.includes("google.com") &&
    !stored.includes("maps.google")
  ) {
    return stored;
  }
  if (!listing.url) return null;
  try {
    const u = new URL(withHttp(listing.url));
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (
      host.includes("google.com") ||
      host.includes("maps.google") ||
      isDirectoryUrl(listing.url)
    ) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

// Re-export for tests that still import distinctiveTokens via presence flows.
export { distinctiveTokens, presenceBrandTokens };
