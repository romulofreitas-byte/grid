import { distinctiveTokens } from "@/lib/enrichment/confirm-domain";
import { isDirectoryUrl } from "@/lib/enrichment/directory-blocklist";
import { searchableCompanyName } from "@/lib/enrichment/company-name";
import type { GmbListing } from "@/lib/types";

export type OrganicHit = { link: string; title: string };

const SOCIAL_HOST: Record<"instagram" | "facebook" | "linkedin" | "youtube", string> = {
  instagram: "instagram.com",
  facebook: "facebook.com",
  linkedin: "linkedin.com",
  youtube: "youtube.com",
};

function serperKey(): string | null {
  return process.env.SERPER_API_KEY ?? null;
}

export function titleMatchesCompany(
  title: string,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
): boolean {
  const tokens = distinctiveTokens(razaoSocial, nomeFantasia, municipio);
  if (tokens.length === 0) return false;
  const hay = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  const hits = tokens.filter((t) => hay.includes(t));
  return hits.length >= Math.min(2, tokens.length);
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
    organic?: Array<{ link?: string; title?: string }>;
  };
  const hits: OrganicHit[] = [];
  for (const item of json.organic ?? []) {
    if (!item.link || isDirectoryUrl(item.link)) continue;
    hits.push({ link: item.link, title: item.title ?? "" });
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

export function pickSocialHit(
  hits: OrganicHit[],
  host: string,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
): string | null {
  for (const hit of hits) {
    try {
      const hostname = new URL(hit.link).hostname.toLowerCase();
      if (!hostname.includes(host)) continue;
    } catch {
      continue;
    }
    if (titleMatchesCompany(hit.title, razaoSocial, nomeFantasia, municipio)) {
      return hit.link;
    }
  }
  const first = hits.find((hit) => {
    try {
      return new URL(hit.link).hostname.toLowerCase().includes(host);
    } catch {
      return false;
    }
  });
  return first?.link ?? null;
}

export function presenceQuery(
  platform: keyof typeof SOCIAL_HOST | "gmb",
  nomeFantasia: string | null,
  razaoSocial: string,
  municipio: string,
  uf: string,
): string {
  const name = searchableCompanyName(nomeFantasia, razaoSocial);
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
}): Promise<string | null> {
  const q = presenceQuery(
    input.platform,
    input.nomeFantasia,
    input.razaoSocial,
    input.municipio,
    input.uf,
  );
  const hits = await serperOrganic(q);
  return pickSocialHit(
    hits,
    SOCIAL_HOST[input.platform],
    input.razaoSocial,
    input.nomeFantasia,
    input.municipio,
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
