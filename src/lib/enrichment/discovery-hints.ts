import { parseCompanySite } from "@/lib/enrichment/company-site";
import {
  cidFromMapsUrl,
  isMapsUrl,
  mapsPlaceNameFromUrl,
} from "@/lib/enrichment/company-name";
import { parseInstagramHandle } from "@/lib/instagram";
import type { EnrichmentDiscoveryHints } from "@/lib/types";

const LABEL_SITE = /^(?:site|website|url|dominio|domínio)\s*:\s*(.+)$/i;
const LABEL_IG = /^(?:instagram|insta|ig)\s*:\s*(.+)$/i;
const LABEL_MAPS = /^(?:nome no maps|maps|google maps|gmb)\s*:\s*(.+)$/i;
const BARE_URL =
  /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/[^\s]+|(?:maps\.app\.goo\.gl|google\.com\/maps)[^\s]*|[a-z0-9.-]+\.[a-z]{2,}[^\s]*)/gi;
const AT_HANDLE = /(^|\s)@([A-Za-z0-9._]{2,30})\b/;

export function parseDiscoveryHints(input: {
  notes?: string | null;
  companyName?: string | null;
}): EnrichmentDiscoveryHints {
  const names: string[] = [];
  const pushName = (raw: string | null | undefined) => {
    const name = raw?.replace(/\s+/g, " ").trim();
    if (!name || name.length < 3) return;
    if (names.some((item) => item.toLowerCase() === name.toLowerCase())) return;
    names.push(name.slice(0, 120));
  };

  pushName(input.companyName);

  let domain: string | null = null;
  let instagram: string | null = null;
  let mapsUrl: string | null = null;

  const notes = input.notes?.trim() ?? "";
  for (const line of notes.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const site = trimmed.match(LABEL_SITE)?.[1];
    if (site) {
      const parsed = parseCompanySite(site);
      if (parsed && !domain) domain = parsed.host;
      continue;
    }
    const ig = trimmed.match(LABEL_IG)?.[1];
    if (ig) {
      const handle = parseInstagramHandle(ig);
      if (handle && !instagram) instagram = handle;
      continue;
    }
    const maps = trimmed.match(LABEL_MAPS)?.[1];
    if (maps) {
      if (isMapsUrl(maps) && !mapsUrl) mapsUrl = maps.trim();
      else pushName(maps);
    }
  }

  if (notes) {
    for (const raw of notes.match(BARE_URL) ?? []) {
      const token = raw.replace(/[),.;]+$/, "");
      if (parseInstagramHandle(token)) {
        if (!instagram) instagram = parseInstagramHandle(token);
        continue;
      }
      if (isMapsUrl(token)) {
        if (!mapsUrl) mapsUrl = token.startsWith("http") ? token : `https://${token}`;
        const place = mapsPlaceNameFromUrl(mapsUrl);
        if (place) pushName(place);
        continue;
      }
      const site = parseCompanySite(token);
      if (site && !domain) domain = site.host;
    }
    const at = notes.match(AT_HANDLE)?.[2];
    if (at && !instagram) instagram = parseInstagramHandle(`@${at}`);
  }

  if (mapsUrl && cidFromMapsUrl(mapsUrl) && !mapsUrl.startsWith("http")) {
    mapsUrl = `https://${mapsUrl}`;
  }

  return {
    names,
    domain,
    instagram,
    mapsUrl,
  };
}

export function mergeDiscoveryHints(
  ...parts: Array<EnrichmentDiscoveryHints | null | undefined>
): EnrichmentDiscoveryHints {
  const names: string[] = [];
  let domain: string | null = null;
  let instagram: string | null = null;
  let mapsUrl: string | null = null;
  for (const part of parts) {
    if (!part) continue;
    for (const name of part.names) {
      if (!names.some((item) => item.toLowerCase() === name.toLowerCase())) {
        names.push(name);
      }
    }
    if (!domain && part.domain) domain = part.domain;
    if (!instagram && part.instagram) instagram = part.instagram;
    if (!mapsUrl && part.mapsUrl) mapsUrl = part.mapsUrl;
  }
  return { names, domain, instagram, mapsUrl };
}

export function hintsAreEmpty(hints: EnrichmentDiscoveryHints): boolean {
  return (
    hints.names.length === 0 &&
    !hints.domain &&
    !hints.instagram &&
    !hints.mapsUrl
  );
}
