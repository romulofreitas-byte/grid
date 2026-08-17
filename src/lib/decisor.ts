import { classifyPartner, isPessoaFisica } from "@/lib/partner-kind";
import type { Partner, PartnerCard, RefQualificacao } from "@/lib/types";

/** Priority by description match — never hardcode qualification IDs. */
export const DECISOR_PRIORITY: Array<{ match: string[]; rank: number }> = [
  { match: ["sócio-administrador", "socio-administrador", "sócio administrador"], rank: 1 },
  { match: ["titular pessoa física", "titular pessoa fisica"], rank: 2 },
  { match: ["administrador"], rank: 3 },
  { match: ["presidente"], rank: 4 },
  { match: ["diretor"], rank: 5 },
  { match: ["sócio", "socio"], rank: 6 },
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function qualificacaoRank(
  qualificacaoId: number,
  refs: RefQualificacao[],
): number {
  const ref = refs.find((r) => r.id === qualificacaoId);
  if (!ref) return 99;
  const desc = normalize(ref.descricao);
  for (const rule of DECISOR_PRIORITY) {
    if (rule.match.some((m) => desc.includes(normalize(m)))) {
      return rule.rank;
    }
  }
  return 50;
}

function sortPartners(
  partners: Partner[],
  refs: RefQualificacao[],
): Partner[] {
  return [...partners].sort((a, b) => {
    const ra = qualificacaoRank(a.qualificacao_id, refs);
    const rb = qualificacaoRank(b.qualificacao_id, refs);
    if (ra !== rb) return ra - rb;
    const da = a.data_entrada ?? "9999-99-99";
    const db = b.data_entrada ?? "9999-99-99";
    return da.localeCompare(db);
  });
}

export function pickDecisor(
  partners: Partner[],
  refs: RefQualificacao[],
): Partner | null {
  if (!partners.length) return null;
  const sorted = sortPartners(partners, refs);
  const person = sorted.find((p) => isPessoaFisica(p.nome, p.faixa_etaria));
  return person ?? sorted[0] ?? null;
}

export function toPartnerCards(
  partners: Partner[],
  refs: RefQualificacao[],
): PartnerCard[] {
  return sortPartners(partners, refs).map((p) => {
    const classified = classifyPartner(p.nome, p.faixa_etaria);
    return {
      nome: p.nome,
      qualificacao: qualificacaoLabel(p.qualificacao_id, refs),
      dataEntrada: p.data_entrada,
      faixaEtaria: p.faixa_etaria,
      kind: classified.kind,
      kindLabel: classified.label,
    };
  });
}

export function qualificacaoLabel(
  qualificacaoId: number,
  refs: RefQualificacao[],
): string {
  return refs.find((r) => r.id === qualificacaoId)?.descricao ?? "NÃO ENCONTRADO";
}
