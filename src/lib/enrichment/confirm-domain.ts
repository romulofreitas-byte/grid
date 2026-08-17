const STOPWORDS = new Set([
  "ltda",
  "me",
  "epp",
  "eireli",
  "sa",
  "s/a",
  "s.a",
  "comercio",
  "comercial",
  "industria",
  "industrial",
  "servicos",
  "empresa",
  "do",
  "da",
  "de",
  "e",
  "brasil",
]);

function stripAccents(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function distinctiveTokens(
  razao: string,
  fantasia: string | null,
  municipio: string,
): string[] {
  const blob = `${razao} ${fantasia ?? ""}`;
  const mun = stripAccents(municipio);
  const tokens = stripAccents(blob)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && t !== mun);
  return [...new Set(tokens)];
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function confirmDomainOwnership(input: {
  html: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  municipio: string;
}): boolean {
  const html = stripAccents(input.html);
  const cnpjDigits = digitsOnly(input.cnpj);
  if (cnpjDigits.length === 14 && digitsOnly(input.html).includes(cnpjDigits)) {
    return true;
  }
  const tokens = distinctiveTokens(
    input.razaoSocial,
    input.nomeFantasia,
    input.municipio,
  );
  const hits = tokens.filter((t) => html.includes(t));
  return hits.length >= 2;
}
