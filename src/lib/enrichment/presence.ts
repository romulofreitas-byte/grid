import {
  brandTokenHits,
  distinctiveTokens,
  presenceBrandTokens,
} from "@/lib/enrichment/confirm-domain";
import { isDirectoryUrl } from "@/lib/enrichment/directory-blocklist";
import { searchableCompanyName } from "@/lib/enrichment/company-name";
import { parseInstagramHandle } from "@/lib/instagram";
import type { GmbListing } from "@/lib/types";

export type OrganicHit = { link: string; title: string; snippet?: string };

/** Minimum distinctive-token hits in title/snippet to accept a domain candidate. */
export const DOMAIN_SCORE_MIN = 1;

const SOCIAL_HOST: Record<"instagram" | "facebook" | "linkedin" | "youtube", string> = {
  instagram: "instagram.com",
  facebook: "facebook.com",
  linkedin: "linkedin.com",
  youtube: "youtube.com",
};

function serperKey(): string | null {
  return process.env.SERPER_API_KEY ?? null;
}

function stripAccents(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
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

export function scoreDomainHit(
  hit: OrganicHit,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
): number {
  const blob = `${hit.title} ${hit.snippet ?? ""}`;
  const strong = presenceBrandTokens(razaoSocial, nomeFantasia, municipio);
  const hay = stripAccents(blob);
  if (strong.length > 0) {
    return strong.filter((t) => hay.includes(t)).length;
  }
  // Weak-only brands: require ≥2 distinctive tokens to propose a domain.
  const hits = brandTokenHits(blob, razaoSocial, nomeFantasia, municipio);
  return hits >= 2 ? hits : 0;
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

export async function serperOrganic(
  query: string,
  num = 5,
): Promise<OrganicHit[]> {
  const key = serperKey();
  if (!key) return [];
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "br", hl: "pt-br", num }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    organic?: Array<{ link?: string; title?: string; snippet?: string }>;
  };
  const hits: OrganicHit[] = [];
  for (const item of json.organic ?? []) {
    if (!item.link) continue;
    // Do not filter social hosts here — presence search needs instagram.com etc.
    // Domain pickers (pickBestDomainHit / serperSearch) still apply isDirectoryUrl.
    hits.push({
      link: item.link,
      title: item.title ?? "",
      snippet: item.snippet ?? "",
    });
  }
  return hits;
}

export async function serperMaps(query: string): Promise<GmbListing | null> {
  const key = serperKey();
  if (!key) return null;
  const res = await fetch("https://google.serper.dev/maps", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "br", hl: "pt-br" }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    places?: Array<{
      title?: string;
      website?: string;
      link?: string;
      cid?: string;
    }>;
  };
  const place = json.places?.[0];
  if (!place?.title) return null;
  const url =
    place.website ||
    place.link ||
    (place.cid
      ? `https://www.google.com/maps?cid=${encodeURIComponent(place.cid)}`
      : null);
  if (!url) return null;
  return { name: place.title, url, matched: true };
}

/** Only accept a social hit when title/handle correlates with a strong brand token. */
export function pickSocialHit(
  hits: OrganicHit[],
  host: string,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
  blockedLabels: string[] = [],
): string | null {
  const blocked = blockedLabels
    .map((l) => l.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((l) => l.length >= 4);
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
    if (socialHitMatchesBrand(hit, razaoSocial, nomeFantasia, municipio)) {
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
): string {
  const name =
    brandOverride?.trim() ||
    searchableCompanyName(nomeFantasia, razaoSocial);
  const place = [municipio, uf].filter(Boolean).join(" ");
  if (platform === "gmb") {
    return `"${name}" ${place}`.trim();
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
}): Promise<string | null> {
  const strong = presenceBrandTokens(
    input.razaoSocial,
    input.brandOverride?.trim() || input.nomeFantasia,
    input.municipio,
  );
  // No distinctive brand signal → refuse search (avoid @sagem / Silva false positives).
  if (strong.length === 0) return null;

  const q = presenceQuery(
    input.platform,
    input.nomeFantasia,
    input.razaoSocial,
    input.municipio,
    input.uf,
    input.brandOverride,
  );
  const hits = await serperOrganic(q);
  return pickSocialHit(
    hits,
    SOCIAL_HOST[input.platform],
    input.razaoSocial,
    input.brandOverride?.trim() || input.nomeFantasia,
    input.municipio,
    input.blockedLabels,
  );
}

export async function searchGmb(input: {
  nomeFantasia: string | null;
  razaoSocial: string;
  municipio: string;
  uf: string;
}): Promise<GmbListing | null> {
  const q = presenceQuery(
    "gmb",
    input.nomeFantasia,
    input.razaoSocial,
    input.municipio,
    input.uf,
  );
  const listing = await serperMaps(q);
  if (!listing) return { name: "", url: "", matched: false };
  listing.matched = titleMatchesCompany(
    listing.name,
    input.razaoSocial,
    input.nomeFantasia,
    input.municipio,
  );
  if (!listing.matched) return { ...listing, matched: false };
  return listing;
}

/** Extract a website host from a matched GMB listing (not maps.google). */
export function domainFromGmb(listing: GmbListing | null): string | null {
  if (!listing?.matched || !listing.url) return null;
  try {
    const u = new URL(listing.url);
    const host = u.hostname.toLowerCase();
    if (
      host.includes("google.com") ||
      host.includes("maps.google") ||
      isDirectoryUrl(listing.url)
    ) {
      return null;
    }
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Re-export for tests that still import distinctiveTokens via presence flows.
export { distinctiveTokens, presenceBrandTokens };
