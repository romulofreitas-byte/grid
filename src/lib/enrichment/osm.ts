import { normalizePhoneBR, phonesMatch } from "@/lib/phone";
import type { LeadEnrichment } from "@/lib/types";

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const OSM_OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OSM_UA = "GridBot/1.0 (+https://grid.mundopodium.com.br/bot)";

export type OsmElement = {
  tags?: Record<string, string>;
};

export type OsmVerdict = {
  matched: boolean;
  attribution: string;
};

function escapeOverpassRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractOsmPhoneRaws(tags: Record<string, string>): string[] {
  const blobs = [tags.phone, tags["contact:phone"], tags["contact:mobile"]];
  const raws: string[] = [];
  for (const blob of blobs) {
    if (!blob) continue;
    for (const part of blob.split(/[;|/]/)) {
      const trimmed = part.trim();
      if (trimmed) raws.push(trimmed);
    }
  }
  return raws;
}

export function websiteHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const href = url.includes("://") ? url : `https://${url}`;
    return new URL(href).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function preferOsmElements(
  elements: OsmElement[],
  domain: string | null,
): OsmElement[] {
  if (!domain) return elements;
  const want = domain.replace(/^www\./, "").toLowerCase();
  const matched = elements.filter((el) => {
    const host = websiteHost(el.tags?.website ?? el.tags?.["contact:website"]);
    return host === want || host?.endsWith(`.${want}`) || want.endsWith(`.${host}`);
  });
  return matched.length ? matched : elements;
}

export function evaluateOsm(
  elements: OsmElement[],
  knownPhones: string[],
  fallbackDdd?: string | null,
  domain?: string | null,
): OsmVerdict | null {
  const selected = preferOsmElements(elements, domain ?? null);
  const raws = selected.flatMap((el) => extractOsmPhoneRaws(el.tags ?? {}));
  if (!raws.length) return null;

  const known = knownPhones
    .map((p) => normalizePhoneBR(p, fallbackDdd))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  if (!known.length) return null;

  const matched = raws.some((raw) =>
    known.some((k) => phonesMatch(raw, k.e164, fallbackDdd)),
  );
  return { matched, attribution: OSM_ATTRIBUTION };
}

export function buildOverpassQuery(input: {
  razaoSocial: string;
  nomeFantasia: string | null;
  municipioNome: string;
  uf: string;
  logradouro: string | null;
  numero: string | null;
}): string {
  const name = (input.nomeFantasia?.trim() || input.razaoSocial).slice(0, 80);
  const nameRe = escapeOverpassRegex(name);
  const cityRe = escapeOverpassRegex(input.municipioNome);
  const uf = input.uf.toUpperCase();
  const clauses = [
    `nwr["name"~"${nameRe}",i]["addr:city"~"${cityRe}",i](area.uf);`,
    `nwr["alt_name"~"${nameRe}",i]["addr:city"~"${cityRe}",i](area.uf);`,
  ];
  if (input.logradouro && input.numero) {
    const streetRe = escapeOverpassRegex(input.logradouro);
    const num = escapeOverpassRegex(input.numero);
    clauses.push(
      `nwr["addr:street"~"${streetRe}",i]["addr:housenumber"="${num}"]["addr:city"~"${cityRe}",i](area.uf);`,
    );
  }
  return `[out:json][timeout:8];
area["ISO3166-2"="BR-${uf}"]->.uf;
(
  ${clauses.join("\n  ")}
);
out tags 15;`;
}

export type ConfirmOsmInput = {
  razaoSocial: string;
  nomeFantasia: string | null;
  municipioNome: string;
  uf: string;
  logradouro: string | null;
  numero: string | null;
  knownPhones: string[];
  fallbackDdd?: string | null;
  domain?: string | null;
  fetchImpl?: typeof fetch;
};

export async function confirmWithOsm(
  input: ConfirmOsmInput,
): Promise<OsmVerdict | null> {
  if (!input.knownPhones.length) return null;
  const query = buildOverpassQuery(input);
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(OSM_OVERPASS_URL, {
      method: "POST",
      headers: {
        "User-Agent": OSM_UA,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { elements?: OsmElement[] };
    return evaluateOsm(
      json.elements ?? [],
      input.knownPhones,
      input.fallbackDdd,
      input.domain,
    );
  } catch {
    return null;
  }
}

export function phonesForOsm(row: {
  phones: Array<{ e164: string; sources: string[] }>;
}): string[] {
  return row.phones
    .filter((e) => e.sources.some((s) => s !== "osm"))
    .map((e) => e.e164);
}

export async function applyOsmFollowup(
  row: LeadEnrichment,
  input: Omit<ConfirmOsmInput, "knownPhones" | "domain"> & {
    domain?: string | null;
  },
): Promise<LeadEnrichment | null> {
  const osm = await confirmWithOsm({
    ...input,
    knownPhones: phonesForOsm(row),
    domain: input.domain ?? row.domain,
  });
  if (!osm) return null;
  return { ...row, osm };
}

let osmTail: Promise<void> = Promise.resolve();

/** One Overpass call at a time. Does not block the caller. */
export function enqueueOsmFollowup(task: () => Promise<void>): Promise<void> {
  const run = osmTail.then(task, task);
  osmTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
