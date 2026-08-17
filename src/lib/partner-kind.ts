import type { PartnerKind } from "@/lib/types";

export type ClassifiedPartner = {
  kind: PartnerKind;
  label: string | null;
};

const CORPORATE_LAST = new Set([
  "ltda",
  "eireli",
  "sa",
  "s/a",
  "s.a",
  "s.a.",
  "me",
  "epp",
  "ss",
  "cia",
]);

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function tokens(nome: string): string[] {
  return normalize(nome)
    .split(/[\s,]+/)
    .filter(Boolean);
}

export function hasCorporateSuffix(nome: string): boolean {
  const parts = tokens(nome);
  if (!parts.length) return false;
  const last = parts[parts.length - 1]!;
  if (CORPORATE_LAST.has(last)) return true;
  if (parts.length >= 2 && parts[parts.length - 2] === "s" && last === "a") {
    return true;
  }
  return false;
}

const HOLDING_RE = /\b(holding|participacoes|investimentos?)\b/;
const GESTAO_RE = /\b(gestao|administradora de bens|asset|family office)\b/;

export function classifyPartner(
  nome: string,
  faixaEtaria: number | null,
): ClassifiedPartner {
  const n = normalize(nome);
  if (HOLDING_RE.test(n)) return { kind: "holding", label: "Holding" };
  if (GESTAO_RE.test(n)) return { kind: "gestao", label: "Empresa de gestão" };
  if (faixaEtaria === 0 || hasCorporateSuffix(nome)) {
    return { kind: "empresa", label: "Empresa sócia" };
  }
  return { kind: "pessoa", label: null };
}

export function isPessoaFisica(
  nome: string,
  faixaEtaria: number | null,
): boolean {
  return classifyPartner(nome, faixaEtaria).kind === "pessoa";
}
