import { DEFAULT_PIPELINE_NAME } from "@/lib/crm/cadence";
import type { CrmDealCard, CrmDealMeta } from "@/lib/crm/types";
import type { GridRepo } from "@/lib/data/repo";
import { displayCompanyName } from "@/lib/enrichment/company-name";
import { formatPhone } from "@/lib/format";
import type { Search, SearchFilters } from "@/lib/types";

export function normalizePipelineNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function resolveCrmPipelineNome(input: {
  segmentNome: string | null | undefined;
  intentQuery: string | null | undefined;
  searchNome: string;
}): string {
  const segment = input.segmentNome?.trim();
  if (segment) return normalizePipelineNome(segment);

  const intent = input.intentQuery?.trim();
  if (intent && intent.length >= 2) return normalizePipelineNome(intent);

  const stripped = input.searchNome
    .replace(/^Lista\s*[·•\-–]\s*/i, "")
    .trim();
  if (stripped) return normalizePipelineNome(stripped);

  return DEFAULT_PIPELINE_NAME;
}

export function digitsCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "").padStart(14, "0");
}

export function pistaNomeForSearch(
  search: { nome: string; filtros: { intentQuery?: string | null } },
  pipelineNomes: string[],
  segmentNome?: string | null,
): string | null {
  if (pipelineNomes.length === 0) return null;
  const resolved = resolveCrmPipelineNome({
    segmentNome,
    intentQuery: search.filtros.intentQuery,
    searchNome: search.nome,
  });
  const hit = pipelineNomes.find(
    (nome) => nome.trim().toLowerCase() === resolved.toLowerCase(),
  );
  if (hit) return hit;
  const haystack = search.nome.toLowerCase();
  return (
    pipelineNomes.find((nome) => {
      const needle = nome.trim().toLowerCase();
      return needle.length >= 3 && haystack.includes(needle);
    }) ?? null
  );
}

export type CrmBridgeRepo = Pick<
  GridRepo,
  | "listCrmPipelines"
  | "createCrmPipeline"
  | "findCrmDealByCnpj"
  | "createCrmDeal"
  | "getDossier"
  | "getPreset"
  | "listCompanyBriefs"
>;

export type BridgeQualifyResult = {
  created: number;
  skipped: number;
  pipelineId: string | null;
  pipelineNome: string | null;
};

function localMeta(
  filters: SearchFilters,
  searchId: string,
  source: NonNullable<CrmDealMeta["source"]> = "qualify_bridge",
): CrmDealMeta {
  return {
    searchId,
    ufs: filters.ufs,
    municipioIds: filters.municipioIds,
    source,
  };
}

/**
 * After qualify on a saved list: ensure niche pipeline and upsert deals
 * at Entrada de Lista (first stage). Cities stay in meta — never new pipelines.
 */
export async function bridgeQualifiedLeadsToCrm(
  repo: CrmBridgeRepo,
  input: {
    userId: string;
    search: Search;
    cnpjs: string[];
    source?: NonNullable<CrmDealMeta["source"]>;
  },
): Promise<BridgeQualifyResult> {
  const empty: BridgeQualifyResult = {
    created: 0,
    skipped: 0,
    pipelineId: null,
    pipelineNome: null,
  };
  if (!input.search.saved) return empty;
  if (!input.cnpjs.length) return empty;

  const segmentId =
    input.search.filtros.segmentIds[0] ?? input.search.filtros.presetId;
  const preset = segmentId ? await repo.getPreset(segmentId) : null;
  const pipelineNome = resolveCrmPipelineNome({
    segmentNome: preset?.nome,
    intentQuery: input.search.filtros.intentQuery,
    searchNome: input.search.nome,
  });

  const pipelines = await repo.listCrmPipelines(input.userId);
  const existing = pipelines.find(
    (p) => p.nome.trim().toLowerCase() === pipelineNome.toLowerCase(),
  );
  const pipeline =
    existing ?? (await repo.createCrmPipeline(input.userId, pipelineNome));

  const meta = localMeta(
    input.search.filtros,
    input.search.id,
    input.source ?? "qualify_bridge",
  );
  let created = 0;
  let skipped = 0;

  const briefs = await repo.listCompanyBriefs(input.cnpjs);
  const briefByCnpj = new Map(
    briefs.map((row) => [digitsCnpj(row.cnpj), row] as const),
  );

  for (const raw of input.cnpjs) {
    const cnpj = digitsCnpj(raw);
    const already = await repo.findCrmDealByCnpj(
      input.userId,
      pipeline.id,
      cnpj,
    );
    if (already) {
      skipped += 1;
      continue;
    }

    const brief = briefByCnpj.get(cnpj);
    let company_name = brief
      ? displayCompanyName(brief.nomeFantasia, brief.razaoSocial)
      : "";
    let contact_name = brief?.decisorNome ?? "";
    let phones = brief
      ? [formatPhone(brief.ddd1, brief.telefone1)].filter(
          (p): p is string => Boolean(p),
        )
      : [];

    if (!brief) {
      const dossier = await repo.getDossier(cnpj, input.search.id);
      if (!dossier) {
        skipped += 1;
        continue;
      }
      company_name = displayCompanyName(
        dossier.establishment.nome_fantasia,
        dossier.company.razao_social,
      );
      contact_name = dossier.decisor?.nome ?? "";
      phones = dossier.contacts
        .map((c) => formatPhone(c.ddd, c.telefone))
        .filter((p): p is string => Boolean(p));
    }

    const deal: CrmDealCard | null = await repo.createCrmDeal(input.userId, {
      pipelineId: pipeline.id,
      company_name: company_name || cnpj,
      contact_name,
      phones,
      cnpj,
      meta,
      notes: "",
    });
    if (deal) created += 1;
    else skipped += 1;
  }

  return {
    created,
    skipped,
    pipelineId: pipeline.id,
    pipelineNome: pipeline.nome,
  };
}
