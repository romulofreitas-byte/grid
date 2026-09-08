import { searchableCompanyName } from "@/lib/enrichment/company-name";
import {
  distinctiveTokens,
  presenceBrandTokens,
} from "@/lib/enrichment/confirm-domain";

function stripAlias(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function sameAlias(a: string, b: string): boolean {
  const left = stripAlias(a);
  const right = stripAlias(b);
  return Boolean(left) && left === right;
}

/**
 * Search names beyond fantasia-or-razão: both cadastro names, weak+trade
 * compounds (Metalúrgica Vaz ↔ Vaz e Vaz Metalurgia), and a compact brand.
 */
export function discoveryAliases(input: {
  nomeFantasia: string | null | undefined;
  razaoSocial: string;
  extraNames?: string[];
}): string[] {
  const out: string[] = [];
  const push = (raw: string | null | undefined) => {
    const name = raw?.replace(/\s+/g, " ").trim();
    if (!name || name.length < 3) return;
    if (out.some((item) => sameAlias(item, name))) return;
    out.push(name);
  };

  push(input.nomeFantasia);
  push(searchableCompanyName(null, input.razaoSocial));
  for (const extra of input.extraNames ?? []) push(extra);
  for (const seed of [...out]) {
    if (seed.includes("@")) push(seed.replace(/@/g, "O"));
  }

  const tokens = distinctiveTokens(
    input.razaoSocial,
    input.nomeFantasia ?? null,
    "",
  );
  for (let i = 0; i < tokens.length && i < 4; i++) {
    for (let j = i + 1; j < tokens.length && j < 5; j++) {
      push(`${tokens[i]} ${tokens[j]}`);
      push(`${tokens[j]} ${tokens[i]}`);
    }
  }

  const compact = presenceBrandTokens(
    input.razaoSocial,
    input.nomeFantasia ?? null,
    "",
  )[0];
  if (compact && compact.length >= 4) push(compact);

  return out;
}

/** Aliases that are not the primary fantasia / stripped razão query name. */
export function extraDiscoveryAliases(
  input: Parameters<typeof discoveryAliases>[0],
  limit = 2,
): string[] {
  const primary = [
    input.nomeFantasia?.trim(),
    searchableCompanyName(null, input.razaoSocial),
  ].filter((name): name is string => Boolean(name));
  return discoveryAliases(input)
    .filter((alias) => !primary.some((name) => sameAlias(name, alias)))
    .slice(0, limit);
}

export function quotedAliasPlaceQueries(
  input: Parameters<typeof discoveryAliases>[0] & {
    municipio?: string;
    uf?: string;
  },
  limit = 2,
): string[] {
  const place = [input.municipio, input.uf].filter(Boolean).join(" ").trim();
  const extra = extraDiscoveryAliases(input, limit);
  return extra.map((alias) =>
    [`"${alias}"`, place].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(),
  );
}

export function domainHostMatchesBrand(
  host: string,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
): boolean {
  const hostname = host
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    ?.split(":")[0]
    ?.toLowerCase();
  if (!hostname) return false;
  const label = hostname.split(".")[0] ?? "";
  return hostLabelMatchesBrand(label, razaoSocial, nomeFantasia, municipio) > 0;
}

export function handleMatchesBrand(
  handle: string,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
): boolean {
  const compact = handle.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact.length < 4) return false;
  const strong = presenceBrandTokens(razaoSocial, nomeFantasia, municipio);
  if (strong.length > 0) {
    return strong.some((token) => token.length >= 4 && compact.includes(token));
  }
  const parts = distinctiveTokens(razaoSocial, nomeFantasia, municipio).filter(
    (token) => token.length >= 4,
  );
  return parts.filter((token) => compact.includes(token)).length >= 2;
}

export function handleHasDistinctiveToken(
  handle: string,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
): boolean {
  const compact = handle.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact.length < 3) return false;
  return distinctiveTokens(razaoSocial, nomeFantasia, municipio).some(
    (token) => token.length >= 3 && compact.includes(token),
  );
}

export function hostLabelMatchesBrand(
  label: string,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
): number {
  const compact = label.replace(/[^a-z0-9]/g, "");
  if (compact.length < 4) return 0;
  const strong = presenceBrandTokens(razaoSocial, nomeFantasia, municipio);
  const strongHits = strong.filter(
    (token) => token.length >= 4 && compact.includes(token),
  ).length;
  if (strongHits > 0) return strongHits;

  const parts = distinctiveTokens(razaoSocial, nomeFantasia, municipio).filter(
    (token) => token.length >= 3,
  );
  for (let i = 0; i < parts.length; i++) {
    for (let j = 0; j < parts.length; j++) {
      if (i === j) continue;
      const glued = `${parts[i]}${parts[j]}`;
      if (glued.length >= 6 && compact.includes(glued)) return 1;
    }
  }
  return 0;
}
