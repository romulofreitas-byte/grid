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

export function mapsListingHref(
  listing: { matched?: boolean; cid?: string | null; url?: string } | null | undefined,
): string | null {
  if (!listing?.matched) return null;
  if (listing.cid) return mapsCidUrl(listing.cid);
  return listing.url?.trim() || null;
}

/** Prefer a matched listing cid; otherwise a quoted search, not a naked neighborhood query. */
export function leadMapsHref(
  input: Parameters<typeof companyMapsQuery>[0],
  listing?: { matched?: boolean; cid?: string | null; url?: string } | null,
): string {
  const fromListing = mapsListingHref(listing);
  if (fromListing && listing?.cid) return fromListing;
  if (
    fromListing &&
    /google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(fromListing)
  ) {
    return fromListing;
  }
  return companyMapsSearchUrl(input);
}

export function domainSearchQueries(input: {
  nomeFantasia: string | null | undefined;
  razaoSocial: string;
  municipio: string;
  uf: string;
}): string[] {
  const place = [input.municipio, input.uf].filter(Boolean).join(" ").trim();
  const fantasia = input.nomeFantasia?.trim();
  const queries: string[] = [];
  if (fantasia) queries.push([`"${fantasia}"`, place].filter(Boolean).join(" "));
  const razao = searchableCompanyName(null, input.razaoSocial);
  if (razao && razao.toLowerCase() !== fantasia?.toLowerCase()) {
    queries.push([`"${razao}"`, place].filter(Boolean).join(" "));
  }
  return queries;
}
