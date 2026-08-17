import { PORTE_LABELS } from "@/lib/copy";
import { DEFAULT_FILTERS, type SearchFilters } from "@/lib/types";

export type FilterChip = { key: string; label: string };

export type NicheTreeLike = Array<{
  segments: Array<{ id: string; nome: string }>;
}>;

export function segmentNameMap(tree: NicheTreeLike): Record<string, string> {
  const map: Record<string, string> = {};
  for (const n of tree) {
    for (const s of n.segments) map[s.id] = s.nome;
  }
  return map;
}

export function qualityDiffersFromDefault(filters: SearchFilters): boolean {
  return (
    filters.ocultarTelefonesCompartilhados !==
      DEFAULT_FILTERS.ocultarTelefonesCompartilhados ||
    filters.ocultarEmailsGratuitos !== DEFAULT_FILTERS.ocultarEmailsGratuitos ||
    filters.ocultarEnderecosCompartilhados !==
      DEFAULT_FILTERS.ocultarEnderecosCompartilhados ||
    filters.soEnriquecidas !== DEFAULT_FILTERS.soEnriquecidas ||
    filters.soMatriz !== DEFAULT_FILTERS.soMatriz ||
    filters.excluirSimples !== DEFAULT_FILTERS.excluirSimples ||
    filters.exigirEmailProprio !== DEFAULT_FILTERS.exigirEmailProprio ||
    filters.exigirDecisor !== DEFAULT_FILTERS.exigirDecisor ||
    filters.portes.length > 0 ||
    filters.idadeMinimaAnos !== DEFAULT_FILTERS.idadeMinimaAnos ||
    filters.capitalMin !== DEFAULT_FILTERS.capitalMin ||
    filters.capitalMax !== DEFAULT_FILTERS.capitalMax
  );
}

export function filterStepFilled(
  step: 1 | 2 | 3,
  filters: SearchFilters,
): boolean {
  if (step === 1) {
    return (
      filters.segmentIds.length > 0 ||
      (!!filters.intentQuery && filters.intentQuery.length >= 2) ||
      filters.cnaes.length > 0 ||
      (filters.cnpjs?.length ?? 0) > 0
    );
  }
  if (step === 2) return filters.ufs.length > 0;
  return qualityDiffersFromDefault(filters);
}

export function summarizeFilters(
  filters: SearchFilters,
  segmentNames: Record<string, string> = {},
): FilterChip[] {
  const chips: FilterChip[] = [];

  const named = filters.segmentIds
    .map((id) => ({ id, nome: segmentNames[id] }))
    .filter((s): s is { id: string; nome: string } => !!s.nome);
  const unnamed = filters.segmentIds.length - named.length;
  for (const s of named) {
    chips.push({ key: `seg:${s.id}`, label: s.nome });
  }
  if (unnamed > 0) {
    chips.push({
      key: "segs",
      label:
        named.length === 0
          ? unnamed === 1
            ? "1 segmento"
            : `${unnamed} segmentos`
          : `+${unnamed}`,
    });
  }

  if (filters.intentQuery) {
    chips.push({ key: "intent", label: filters.intentQuery });
  }
  if (filters.cnpjs.length > 0) {
    chips.push({
      key: "cnpjs",
      label:
        filters.cnpjs.length === 1
          ? "1 empresa"
          : `${filters.cnpjs.length} empresas`,
    });
  }
  if (filters.cnaes.length > 0) {
    chips.push({
      key: "cnaes",
      label:
        filters.cnaes.length === 1
          ? "1 CNAE"
          : `${filters.cnaes.length} CNAEs`,
    });
  }

  if (filters.ufs.length > 0) {
    chips.push({ key: "ufs", label: filters.ufs.join(", ") });
  }
  if (filters.municipioIds.length > 0) {
    const n = filters.municipioIds.length;
    chips.push({
      key: "cidades",
      label: n === 1 ? "1 cidade" : `${n} cidades`,
    });
  }

  if (!filters.ocultarTelefonesCompartilhados) {
    chips.push({ key: "tel-shared", label: "incluir telefone compartilhado" });
  }
  if (filters.ocultarEmailsGratuitos) {
    chips.push({ key: "email-free", label: "sem e-mail gratuito" });
  }
  if (filters.ocultarEnderecosCompartilhados) {
    chips.push({ key: "addr-shared", label: "sem endereço compartilhado" });
  }
  if (filters.soEnriquecidas) {
    chips.push({ key: "auditadas", label: "só qualificadas" });
  }
  if (filters.portes.length > 0) {
    chips.push({
      key: "porte",
      label: filters.portes
        .map((p) => PORTE_LABELS[p] ?? p)
        .join(", "),
    });
  }
  if (filters.idadeMinimaAnos > 0) {
    chips.push({
      key: "idade",
      label: `${filters.idadeMinimaAnos} anos+`,
    });
  }
  if (filters.soMatriz) chips.push({ key: "matriz", label: "só matriz" });
  if (filters.excluirSimples) {
    chips.push({ key: "simples", label: "sem Simples" });
  }
  if (filters.exigirEmailProprio) {
    chips.push({ key: "email-own", label: "e-mail próprio" });
  }
  if (filters.exigirDecisor) {
    chips.push({ key: "decisor", label: "com decisor" });
  }

  return chips;
}

export function summarizeFiltersShort(
  filters: SearchFilters,
  segmentNames: Record<string, string> = {},
  max = 4,
): string {
  return summarizeFilters(filters, segmentNames)
    .slice(0, max)
    .map((c) => c.label)
    .join(" · ");
}
