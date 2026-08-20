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
