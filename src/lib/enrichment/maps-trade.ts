import { matchSlugFromCnae } from "@/lib/market/resolve";
import { TAXONOMY } from "@/lib/niches";

const CNAE_STOP = new Set([
  "comercio",
  "varejista",
  "atacadista",
  "atividades",
  "atividade",
  "servicos",
  "servico",
  "instalacao",
  "instalacoes",
  "fabricacao",
  "outros",
  "outras",
  "geral",
  "artigos",
  "produtos",
  "nao",
  "especificados",
  "exceto",
  "para",
  "com",
  "em",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "ao",
  "aos",
]);

function stripAccents(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function sameTrade(a: string, b: string): boolean {
  const left = stripAccents(a).replace(/[^a-z0-9]+/g, "");
  const right = stripAccents(b).replace(/[^a-z0-9]+/g, "");
  return Boolean(left) && left === right;
}

function nicheNomeForSlug(slug: string): string | null {
  for (const niche of TAXONOMY) {
    if (niche.slug === slug) return niche.nome;
    for (const seg of niche.segments) {
      if (seg.slug === slug) return seg.nome;
    }
  }
  return null;
}

/**
 * Maps often uses the trade ("Vidraçaria Modular") while Receita has the
 * legal name ("MODULAR SOLUCOES"). Search the CNAE/ramo label so every lead
 * can find that pin without a human paste.
 */
export function gmbCnaeTradeLabels(
  cnaeDescricao: string | null | undefined,
): string[] {
  const desc = cnaeDescricao?.replace(/\s+/g, " ").trim() ?? "";
  if (!desc) return [];
  const labels: string[] = [];
  const push = (raw: string | null | undefined) => {
    const name = raw?.replace(/\s+/g, " ").trim();
    if (!name || name.length < 4) return;
    if (labels.some((item) => sameTrade(item, name))) return;
    labels.push(name);
  };
  const matched = matchSlugFromCnae(desc);
  if (matched) push(nicheNomeForSlug(matched.slug));
  const tokens = stripAccents(desc)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !CNAE_STOP.has(token));
  for (const token of tokens.slice(0, 2)) push(token);
  return labels.slice(0, 2);
}
