const LEGAL_SUFFIX =
  /\b(?:ltda|me|epp|eireli|s\/a|s\.a\.?|sa)\b\.?/gi;

export function displayCompanyName(
  nomeFantasia: string | null | undefined,
  razaoSocial: string,
): string {
  const fantasia = nomeFantasia?.trim();
  if (fantasia) return fantasia;
  return razaoSocial.trim();
}

const TITLE_PARTICLES = new Set(["da", "das", "de", "do", "dos", "e", "del"]);
const TITLE_LEGAL = new Set(["ltda", "me", "epp", "eireli", "sa", "s/a", "s.a", "s.a."]);

/** Scannable label for the grid — keeps LTDA/ME and 2–3 letter marks. */
export function titleCaseCompanyName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token, index) => {
      if (token === "&") return token;
      const folded = token
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLocaleLowerCase("pt-BR")
        .replace(/\.+$/, "");
      if (TITLE_LEGAL.has(folded) || TITLE_LEGAL.has(token.toLocaleLowerCase("pt-BR"))) {
        return token.toLocaleUpperCase("pt-BR");
      }
      const mixed = token !== token.toLocaleUpperCase("pt-BR")
        && token !== token.toLocaleLowerCase("pt-BR");
      if (mixed) return token;
      if (TITLE_PARTICLES.has(folded) && index > 0) {
        return token.toLocaleLowerCase("pt-BR");
      }
      if (token.length <= 3 && token === token.toLocaleUpperCase("pt-BR")) {
        return token;
      }
      const lower = token.toLocaleLowerCase("pt-BR");
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

export function searchableCompanyName(
  nomeFantasia: string | null | undefined,
  razaoSocial: string,
): string {
  const fantasia = nomeFantasia?.trim();
  if (fantasia) return fantasia;
  const stripped = razaoSocial.replace(LEGAL_SUFFIX, "").replace(/\s+/g, " ").trim();
  return stripped || razaoSocial.trim();
}

/** Human Maps search query — quoted name so Google does not snap to a nearby POI. */
export function companyMapsQuery(input: {
  nomeFantasia: string | null | undefined;
  razaoSocial: string;
  municipio: string;
  uf: string;
  logradouro?: string | null;
  numero?: string | null;
}): string {
  const name = displayCompanyName(input.nomeFantasia, input.razaoSocial).trim();
  return [
    name ? `"${name}"` : "",
    input.logradouro,
    input.numero,
    input.municipio,
    input.uf,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

export function companyMapsSearchUrl(input: Parameters<typeof companyMapsQuery>[0]): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(companyMapsQuery(input))}`;
}

export function mapsCidUrl(cid: string): string {
  return `https://www.google.com/maps?cid=${encodeURIComponent(cid)}`;
}

function withMapsHttp(raw: string): string {
  return /^https?:\/\//i.test(raw)
    ? raw
    : `https://${raw.replace(/^\/\//, "")}`;
}

/** Decimal cid packed in `/place/` `!1s0x…:0x…` feature ids. */
function cidFromMapsFeatureId(raw: string): string | null {
  const match = raw.match(/1s0x[0-9a-f]+:0x([0-9a-f]+)/i);
  if (!match?.[1]) return null;
  try {
    const cid = BigInt(`0x${match[1]}`).toString(10);
    return cid === "0" ? null : cid;
  } catch {
    return null;
  }
}

/** Public cid from a Maps / GBP URL. Short goo.gl links have none. */
export function cidFromMapsUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  try {
    const u = new URL(withMapsHttp(trimmed));
    const fromQuery = u.searchParams.get("cid")?.trim();
    if (fromQuery) return fromQuery;
    const inPath = u.pathname.match(/\/cid\/([^/]+)/i)?.[1]?.trim();
    if (inPath) return inPath;
    const fromData = cidFromMapsFeatureId(
      `${u.pathname}?${u.search}${u.hash}`,
    );
    if (fromData) return fromData;
  } catch {
    /* fall through to the raw string */
  }
  return cidFromMapsFeatureId(trimmed);
}

/** Trading name in `/maps/place/Nome-da-Empresa/…`. */
export function mapsPlaceNameFromUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(withMapsHttp(raw.trim()));
    const seg = u.pathname.match(/\/maps\/place\/([^/]+)/i)?.[1];
    if (!seg) return null;
    const name = decodeURIComponent(seg.replace(/\+/g, " "))
      .replace(/@.*$/, "")
      .replace(/[_-]+/g, " ")
      .trim();
    if (!name || /^[\d.,\-\s]+$/.test(name)) return null;
    return name.slice(0, 120);
  } catch {
    return null;
  }
}

export function isMapsUrl(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  try {
    const withProto = /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw.replace(/^\/\//, "")}`;
    const u = new URL(withProto);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.toLowerCase();
    return (
      host === "maps.google.com" ||
      host === "maps.app.goo.gl" ||
      host === "goo.gl" ||
      (host === "google.com" && path.startsWith("/maps")) ||
      (host.endsWith(".google.com") && path.startsWith("/maps"))
    );
  } catch {
    return false;
  }
}

export function mapsListingHref(
  listing:
    | {
        matched?: boolean;
        status?: string;
        cid?: string | null;
        url?: string;
      }
    | null
    | undefined,
): string | null {
  if (!listing) return null;
  const status =
    listing.status ??
    (listing.matched ? "matched" : listing.cid || listing.url ? "candidate" : "none");
  if (status === "none") {
    const url = listing.url?.trim();
    return url && isMapsUrl(url) ? url : null;
  }
  if (listing.cid) return mapsCidUrl(listing.cid);
  const url = listing.url?.trim();
  if (url && isMapsUrl(url)) return url;
  return url || null;
}

/** Prefer a listing cid; otherwise a quoted search, not a naked neighborhood query. */
export function leadMapsHref(
  input: Parameters<typeof companyMapsQuery>[0],
  listing?: {
    matched?: boolean;
    status?: string;
    cid?: string | null;
    url?: string;
  } | null,
): string {
  const fromListing = mapsListingHref(listing);
  if (fromListing && listing?.cid) return fromListing;
  if (fromListing && isMapsUrl(fromListing)) return fromListing;
  return companyMapsSearchUrl(input);
}

function placeOf(input: {
  municipio: string;
  uf: string;
}): string {
  return [input.municipio, input.uf].filter(Boolean).join(" ").trim();
}

export function domainSearchQueries(input: {
  nomeFantasia: string | null | undefined;
  razaoSocial: string;
  municipio: string;
  uf: string;
}): string[] {
  const place = placeOf(input);
  const fantasia = input.nomeFantasia?.trim();
  const queries: string[] = [];
  if (fantasia) queries.push([`"${fantasia}"`, place].filter(Boolean).join(" "));
  const razao = searchableCompanyName(null, input.razaoSocial);
  if (razao && razao.toLowerCase() !== fantasia?.toLowerCase()) {
    queries.push([`"${razao}"`, place].filter(Boolean).join(" "));
  }
  return queries;
}

/**
 * Unquoted follow-ups when quoted search returns only directories / nothing.
 * Keep short — each query is a Serper call.
 */
export function domainSearchFallbackQueries(input: {
  nomeFantasia: string | null | undefined;
  razaoSocial: string;
  municipio: string;
  uf: string;
}): string[] {
  const place = placeOf(input);
  const fantasia = input.nomeFantasia?.trim();
  const razao = searchableCompanyName(null, input.razaoSocial);
  const out: string[] = [];
  const push = (parts: Array<string | null | undefined>) => {
    const q = parts
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (q && !out.includes(q)) out.push(q);
  };
  if (fantasia) {
    push([fantasia, place, "site"]);
    push([fantasia, place]);
  }
  if (razao && razao.toLowerCase() !== fantasia?.toLowerCase()) {
    push([razao, place, "site"]);
  }
  return out.slice(0, 3);
}

/**
 * Last-resort queries without município/UF. National franchise sites often
 * rank here after local directory noise. Keep to 1–2 Serper calls.
 */
export function domainSearchNationalFallbackQueries(input: {
  nomeFantasia: string | null | undefined;
  razaoSocial: string;
}): string[] {
  const fantasia = input.nomeFantasia?.trim();
  const razao = searchableCompanyName(null, input.razaoSocial);
  const name = fantasia || razao;
  if (!name) return [];
  const out: string[] = [];
  const quoted = `"${name}"`;
  const withSite = `${name} site`;
  out.push(quoted);
  if (withSite !== quoted) out.push(withSite);
  return out.slice(0, 2);
}
