import { hasCorporateSuffix } from "@/lib/partner-kind";

/** RFB natureza jurídica codes for individual / unipessoal vehicles. */
const UNIPESSOAL_NATUREZA_IDS = new Set([
  2135, // Empresário (Individual) — includes MEI
  2305, // EIRELI (natureza empresária)
  2313, // EIRELI (natureza simples)
  2321, // Sociedade Unipessoal de Advogados
  2348, // Inova Simples
  4014, // Empresa Individual Imobiliária
  4120, // Produtor Rural (Pessoa Física)
  2062, // Sociedade Empresária Limitada — SLU shares this code with LTDA
]);

const PARTICLE = new Set(["de", "da", "do", "dos", "das", "e"]);

const LEADING_DOC = [
  /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s+/,
  /^\d{2}\.\d{3}\.\d{3}\s+/,
  /^\d{3}\.\d{3}\.\d{3}-?\d{2}\s+/,
  /^\d{14}\s+/,
  /^\d{11}\s+/,
];

const TRAILING_DOC = [
  /\s+\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
  /\s+\d{3}\.\d{3}\.\d{3}-?\d{2}$/,
  /\s+\d{14}$/,
  /\s+\d{11}$/,
];

export function isNaturezaUnipessoal(naturezaId: number | null | undefined): boolean {
  return naturezaId != null && UNIPESSOAL_NATUREZA_IDS.has(naturezaId);
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function looksLikeTitularName(name: string): boolean {
  if (name.length < 5 || name.length > 80) return false;
  if (/\d/.test(name)) return false;
  if (hasCorporateSuffix(name)) return false;
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 8) return false;
  return parts.every((token, i) => {
    const n = token
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();
    if (PARTICLE.has(n) && i > 0 && i < parts.length - 1) return true;
    return /^[\p{L}][\p{L}'’-]*$/u.test(token) && token.length >= 2;
  });
}

function stripDocuments(razao: string): { rest: string; stripped: boolean } {
  let rest = normalizeSpaces(razao);
  let stripped = false;
  for (const re of LEADING_DOC) {
    const next = rest.replace(re, "");
    if (next !== rest) {
      rest = next.trim();
      stripped = true;
      break;
    }
  }
  for (const re of TRAILING_DOC) {
    const next = rest.replace(re, "");
    if (next !== rest) {
      rest = next.trim();
      stripped = true;
      break;
    }
  }
  return { rest, stripped };
}

/** Strip CPF/CNPJ tokens from razão social. Returns the person name, or null. */
export function extractTitularFromRazao(razaoSocial: string): string | null {
  const { rest, stripped } = stripDocuments(razaoSocial);
  if (!stripped || !looksLikeTitularName(rest)) return null;
  return rest;
}

/**
 * Titular name from razão social when the company is individual/unipessoal
 * and the razão embeds a person name plus a document number.
 */
export function titularFromRazao(
  razaoSocial: string,
  naturezaId: number | null | undefined,
): string | null {
  if (!isNaturezaUnipessoal(naturezaId)) return null;
  return extractTitularFromRazao(razaoSocial);
}
