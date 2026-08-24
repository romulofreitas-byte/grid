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
  "sociedade",
  "associacao",
  "fundacao",
  "instituto",
  "do",
  "da",
  "de",
  "e",
  "brasil",
]);

/**
 * Tokens too weak to prove a social/GMB hit alone (common surnames + generic trade nouns).
 * Used only for presence matching — ownership/domain scoring still uses distinctiveTokens.
 */
const WEAK_PRESENCE_TOKENS = new Set([
  // sobrenomes comuns
  "silva",
  "santos",
  "souza",
  "sousa",
  "oliveira",
  "pereira",
  "costa",
  "ferreira",
  "almeida",
  "rodrigues",
  "lima",
  "gomes",
  "ribeiro",
  "carvalho",
  "alves",
  "soares",
  "nunes",
  "mendes",
  "barros",
  "freitas",
  "cardoso",
  "dias",
  "moreira",
  "teixeira",
  "vieira",
  "barbosa",
  "rocha",
  "marques",
  "araujo",
  "martins",
  "andrade",
  "nascimento",
  "correa",
  "campos",
  "cruz",
  "cunha",
  "duarte",
  "fernandes",
  "garcia",
  "lopes",
  "macedo",
  "moura",
  "neves",
  "pinto",
  "ramos",
  "reis",
  "xavier",
  "machado",
  "azevedo",
  "batista",
  "borges",
  "braga",
  "camargo",
  "castro",
  "cavalcanti",
  "cordeiro",
  "farias",
  "franco",
  "guimaraes",
  "melo",
  "mota",
  "neto",
  "nogueira",
  "pacheco",
  "paulo",
  "peixoto",
  "pinheiro",
  "prado",
  "sales",
  "siqueira",
  "tavares",
  "vaz",
  "viana",
  // prenomes comuns em fantasia (sozinhos não provam ownership)
  "luiz",
  "luis",
  "joao",
  "jose",
  "maria",
  "paulo",
  "pedro",
  "antonio",
  "carlos",
  "ana",
  "francisco",
  "marcos",
  "lucas",
  "gabriel",
  "rafael",
  "bruno",
  "andre",
  "fernando",
  "ricardo",
  "roberto",
  "eduardo",
  // substantivos de ramo genéricos
  "distribuidora",
  "distribuidor",
  "atacado",
  "varejo",
  "loja",
  "lojas",
  "mercado",
  "mercearia",
  "farmacia",
  "clinica",
  "hospital",
  "escola",
  "colegio",
  "faculdade",
  "curso",
  "cursos",
  "centro",
  "center",
  "grupo",
  "holding",
  "pecas",
  "autopecas",
  "automotiva",
  "automotivas",
  "auto",
  "oficina",
  "construtora",
  "imobiliaria",
  "advocacia",
  "contabilidade",
  "padaria",
  "restaurante",
  "lanchonete",
  "bar",
  "hotel",
  "pousada",
  "transportes",
  "transporte",
  "logistica",
  "engenharia",
  "consultoria",
  "assessoria",
  "comercio",
  "comercial",
  "servico",
  "servicos",
  "ensino",
  "educacao",
]);

function stripAccents(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function tokenize(blob: string, municipio: string): string[] {
  const mun = stripAccents(municipio);
  const tokens = stripAccents(blob)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && t !== mun);
  return [...new Set(tokens)];
}

export function distinctiveTokens(
  razao: string,
  fantasia: string | null,
  municipio: string,
): string[] {
  return tokenize(`${razao} ${fantasia ?? ""}`, municipio);
}

/** Fantasia-only tokens (legal suffix noise already stripped via stopwords). */
export function fantasiaTokens(
  fantasia: string | null,
  municipio: string,
): string[] {
  if (!fantasia?.trim()) return [];
  return tokenize(fantasia, municipio);
}

/**
 * Brand tokens strong enough to accept a social/GMB hit from search.
 * Common surnames and generic trade words are dropped.
 */
export function presenceBrandTokens(
  razao: string,
  fantasia: string | null,
  municipio: string,
): string[] {
  return distinctiveTokens(razao, fantasia, municipio).filter(
    (t) => !WEAK_PRESENCE_TOKENS.has(t) && t.length >= 4,
  );
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

  // Only *strong* brand tokens prove ownership (not "auto", "pecas", "silva", "luiz").
  const strong = presenceBrandTokens(
    input.razaoSocial,
    input.nomeFantasia,
    input.municipio,
  );
  if (strong.length === 0) return false;
  const hits = strong.filter((t) => html.includes(t));
  return hits.length >= 1;
}

/** How many distinctive name tokens appear in a title/snippet (for Serper ranking). */
export function brandTokenHits(
  text: string,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
): number {
  const tokens = distinctiveTokens(razaoSocial, nomeFantasia, municipio);
  if (tokens.length === 0) return 0;
  const hay = stripAccents(text);
  return tokens.filter((t) => hay.includes(t)).length;
}
