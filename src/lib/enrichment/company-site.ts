import { isDirectoryUrl } from "@/lib/enrichment/directory-blocklist";
import type { LeadEnrichment } from "@/lib/types";

/** Shallow storefront segment when Serper or a human already pointed here. */
export const SHALLOW_HOME_SEGMENTS = new Set([
  "home",
  "inicio",
  "index",
  "loja",
]);

export type CompanySite = {
  host: string;
  homepagePath: string | null;
};

export function normalizeHomepagePath(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  let pathname = withSlash;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      pathname = new URL(trimmed).pathname;
    }
  } catch {
    return null;
  }
  const collapsed = pathname.replace(/\/+$/, "") || "/";
  if (collapsed === "/") return null;
  const segments = collapsed.split("/").filter(Boolean);
  if (segments.length !== 1) return null;
  const segment = segments[0]!.toLowerCase();
  if (!SHALLOW_HOME_SEGMENTS.has(segment)) return null;
  return `/${segment}`;
}

export function homepagePathFromUrl(link: string): string | null {
  try {
    return normalizeHomepagePath(new URL(link).pathname);
  } catch {
    return null;
  }
}

export function parseCompanySite(raw: string): CompanySite | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/\//, "")}`;
    const u = new URL(withProto);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host.includes(".") || isDirectoryUrl(host)) return null;
    return {
      host,
      homepagePath: normalizeHomepagePath(u.pathname),
    };
  } catch {
    return null;
  }
}

export function homeFetchCandidates(preferred: string | null): string[] {
  const home = normalizeHomepagePath(preferred);
  if (!home) return ["/"];
  return [home];
}

export function companySiteHref(
  domain: string | null | undefined,
  homepagePath?: string | null,
): string | null {
  if (!domain) return null;
  const host = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const path = normalizeHomepagePath(homepagePath);
  return path ? `https://${host}${path}` : `https://${host}`;
}

export function companySiteLabel(
  domain: string | null | undefined,
  homepagePath?: string | null,
): string | null {
  if (!domain) return null;
  const host = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const path = normalizeHomepagePath(homepagePath);
  return path ? `${host}${path}` : host;
}

export function homepagePathOf(row: LeadEnrichment): string | null {
  return (
    normalizeHomepagePath(row.homepage_path) ??
    normalizeHomepagePath(row.fonte.domain?.path)
  );
}

export function hydrateHomepagePath(row: LeadEnrichment): LeadEnrichment {
  const path = homepagePathOf(row);
  if (path === (row.homepage_path ?? null)) return row;
  return { ...row, homepage_path: path };
}
