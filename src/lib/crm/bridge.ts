import { DEFAULT_PIPELINE_NAME } from "@/lib/crm/cadence";
import type { CrmDealCard, CrmDealMeta } from "@/lib/crm/types";
import { COPY } from "@/lib/copy";
import type { GridRepo } from "@/lib/data/repo";
import { displayCompanyName } from "@/lib/enrichment/company-name";
import { formatPhone } from "@/lib/format";
import { cnpjKey, phoneIsHidden } from "@/lib/hidden-phones";
import type { Search, SearchFilters } from "@/lib/types";

export function normalizePipelineNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function pipelineNomeKey(nome: string): string {
  return normalizePipelineNome(nome).toLowerCase();
}

const PIPELINE_SERIES_MAX = 99;

/** Name typed on the saved list. Empty titles fall back to the default pista. */
export function savedListPipelineBase(searchNome: string): string {
  return normalizePipelineNome(searchNome) || DEFAULT_PIPELINE_NAME;
}

/** `index` 1 is the list title. Later sends use `Nome 2`, `Nome 3`, still within 80 chars. */
export function pipelineNomeForSeries(base: string, index: number): string {
  const normalized = savedListPipelineBase(base);
  if (index <= 1) return normalized;
  const suffix = ` ${index}`;
  const room = Math.max(1, 80 - suffix.length);
  const stem = normalized.slice(0, room).trimEnd();
  return `${stem}${suffix}`.slice(0, 80);
}

/** 1 when the pipeline is the list title, 2+ when it is that title plus a numeric suffix. */
export function pipelineSeriesRank(
  pipelineNome: string,
  listNome: string,
): number | null {
  const key = pipelineNomeKey(pipelineNome);
  if (!key) return null;
  const base = savedListPipelineBase(listNome);
  if (key === pipelineNomeKey(pipelineNomeForSeries(base, 1))) return 1;
  const match = key.match(/^(.*) ([1-9]\d*)$/);
  if (!match?.[2]) return null;
  const index = Number(match[2]);
  if (!Number.isSafeInteger(index) || index < 2) return null;
  if (pipelineNomeKey(pipelineNomeForSeries(base, index)) !== key) return null;
  return index;
}

export function latestPipelineNomeForList(
  listNome: string,
  pipelineNomes: string[],
): string | null {
  let best: { nome: string; rank: number } | null = null;
  for (const nome of pipelineNomes) {
    const rank = pipelineSeriesRank(nome, listNome);
    if (rank == null) continue;
    if (!best || rank > best.rank) best = { nome, rank };
  }
  return best?.nome ?? null;
}

/** Next free title for this list. Taken and deleted (blocked) names are skipped. */
export async function nextSavedListPipelineNome(
  searchNome: string,
  existingNomes: string[],
  isBlocked: (nome: string) => Promise<boolean>,
): Promise<string | null> {
  const taken = new Set(existingNomes.map((nome) => pipelineNomeKey(nome)));
  const base = savedListPipelineBase(searchNome);
  for (let index = 1; index <= PIPELINE_SERIES_MAX; index += 1) {
    const nome = pipelineNomeForSeries(base, index);
    if (taken.has(pipelineNomeKey(nome))) continue;
    if (await isBlocked(nome)) continue;
    return nome;
  }
  return null;
}

export function pickDefaultCrmPipeline<T extends { deal_count: number }>(
  pipelines: T[],
): T | undefined {
  if (!pipelines.length) return undefined;
  const withDeals = pipelines.filter((pipeline) => pipeline.deal_count > 0);
  if (!withDeals.length) return pipelines[0];
  return withDeals.reduce((best, pipeline) =>
    pipeline.deal_count > best.deal_count ? pipeline : best,
  );
}

export function digitsCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "").padStart(14, "0");
}

export function pistaNomeForSearch(
  search: { nome: string },
  pipelineNomes: string[],
): string | null {
  if (pipelineNomes.length === 0) return null;
  return latestPipelineNomeForList(search.nome, pipelineNomes);
}

export type CrmBridgeRepo = Pick<
  GridRepo,
  | "listCrmPipelines"
  | "createCrmPipeline"
  | "isCrmPipelineNameBlocked"
  | "findCrmDealByCnpj"
  | "createCrmDeal"
  | "getDossier"
  | "listCompanyBriefs"
  | "listHiddenPhones"
>;

export type BridgeQualifyResult = {
  created: number;
  skipped: number;
  failed: number;
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
 * Each send of a saved list opens a new pipeline named after the list.
 * A taken or deleted name gets the next free suffix. Deals land on
 * Entrada de Lista. A CNPJ already in this new pipeline is skipped.
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
    failed: 0,
    pipelineId: null,
    pipelineNome: null,
  };
  if (!input.search.saved) return empty;
  if (!input.cnpjs.length) return empty;

  const pipelines = await repo.listCrmPipelines(input.userId);
  const pipelineNome = await nextSavedListPipelineNome(
    input.search.nome,
    pipelines.map((pipeline) => pipeline.nome),
    (nome) => repo.isCrmPipelineNameBlocked(input.userId, nome),
  );
  if (!pipelineNome) {
    return {
      created: 0,
      skipped: input.cnpjs.length,
      failed: 0,
      pipelineId: null,
      pipelineNome: null,
    };
  }
  const pipeline = await repo.createCrmPipeline(input.userId, pipelineNome);

  const meta = localMeta(
    input.search.filtros,
    input.search.id,
    input.source ?? "qualify_bridge",
  );
  let created = 0;
  let skipped = 0;
  let failed = 0;

  const briefs = await repo.listCompanyBriefs(input.cnpjs);
  const hiddenByCnpj = await repo.listHiddenPhones(input.userId, input.cnpjs);
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
        failed += 1;
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

    const hidden = hiddenByCnpj.get(cnpjKey(cnpj) ?? cnpj) ?? [];
    phones = phones.filter((phone) => !phoneIsHidden(phone, hidden));

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
    else failed += 1;
  }

  return {
    created,
    skipped,
    failed,
    pipelineId: pipeline.id,
    pipelineNome: pipeline.nome,
  };
}

export type PublicCrmBridge = {
  created: number;
  skipped: number;
  failed: number;
  pipelineId: string | null;
  pipelineNome: string | null;
  error: string | null;
};

export function publicCrmBridge(
  result: BridgeQualifyResult,
  error: string | null = null,
): PublicCrmBridge {
  return {
    created: result.created,
    skipped: result.skipped,
    failed: result.failed,
    pipelineId: result.pipelineId,
    pipelineNome: result.pipelineNome,
    error,
  };
}

export function qualifyCrmHint(
  saved: boolean,
  bridge: PublicCrmBridge | null,
): { hint: string; pipelineId: string | null } {
  if (!saved) {
    return { hint: COPY.crmSaveListToEnter, pipelineId: null };
  }
  if (!bridge || bridge.error) {
    return {
      hint: COPY.crmBridgeFailed,
      pipelineId: bridge?.pipelineId ?? null,
    };
  }
  if (bridge.created > 0) {
    const nome = bridge.pipelineNome ?? COPY.crmNav;
    const main =
      bridge.created === 1
        ? `1 lead no CRM · ${nome}`
        : `${bridge.created} leads no CRM · ${nome}`;
    if (bridge.failed > 0) {
      return {
        hint: `${main}. ${COPY.crmBridgePartial.replace("{n}", String(bridge.failed))}`,
        pipelineId: bridge.pipelineId,
      };
    }
    return { hint: main, pipelineId: bridge.pipelineId };
  }
  if (bridge.failed > 0) {
    return { hint: COPY.crmBridgeFailed, pipelineId: bridge.pipelineId };
  }
  if (bridge.pipelineId) {
    return { hint: COPY.crmOnGrid, pipelineId: bridge.pipelineId };
  }
  return { hint: COPY.crmBridgeFailed, pipelineId: null };
}

