import { classifyPartner, isPessoaFisica } from "@/lib/partner-kind";
import { titularFromRazao } from "@/lib/titular-from-razao";
import type {
  DecisorInfo,
  Partner,
  PartnerCard,
  RefQualificacao,
} from "@/lib/types";

export const TITULAR_FROM_RAZAO_QUALIFICACAO = "Titular";

export type DecisorCompanyHint = {
  razaoSocial: string;
  naturezaId: number | null;
};

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
  company?: DecisorCompanyHint,
): PartnerCard[] {
  if (partners.length) {
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
  const nome = company
    ? titularFromRazao(company.razaoSocial, company.naturezaId)
    : null;
  if (!nome) return [];
  return [
    {
      nome,
      qualificacao: TITULAR_FROM_RAZAO_QUALIFICACAO,
      dataEntrada: null,
      faixaEtaria: null,
      kind: "pessoa",
      kindLabel: null,
    },
  ];
}

export function resolveDecisor(
  partners: Partner[],
  refs: RefQualificacao[],
  company: DecisorCompanyHint,
): DecisorInfo {
  const fromQsa = pickDecisor(partners, refs);
  if (fromQsa) {
    return {
      nome: fromQsa.nome,
      qualificacao: qualificacaoLabel(fromQsa.qualificacao_id, refs),
      dataEntrada: fromQsa.data_entrada,
      faixaEtaria: fromQsa.faixa_etaria,
    };
  }
  const nome = titularFromRazao(company.razaoSocial, company.naturezaId);
  if (!nome) return null;
  return {
    nome,
    qualificacao: TITULAR_FROM_RAZAO_QUALIFICACAO,
    dataEntrada: null,
    faixaEtaria: null,
  };
}

export function qualificacaoLabel(
  qualificacaoId: number,
  refs: RefQualificacao[],
): string {
  return refs.find((r) => r.id === qualificacaoId)?.descricao ?? "NÃO ENCONTRADO";
}
