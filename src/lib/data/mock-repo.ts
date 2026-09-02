import {
  hasAccountantDomainHint,
  isFreeEmail,
  isOwnDomainEmail,
  phoneSealFromUsage,
  sealRank,
} from "@/lib/contact-confidence";
import { pickDecisor, qualificacaoLabel, toPartnerCards } from "@/lib/decisor";
import { yearsSince } from "@/lib/format";
import { getMockStore, type MockStore } from "@/lib/data/mock-store";
import { contactsFromEnrichmentPhones, overlayGridPhone } from "@/lib/grid-phone";
import { isEnrichmentComplete, isEnrichmentVisible } from "@/lib/enrichment/fresh";
import { buildGoldenMinute } from "@/lib/golden-minute";
import {
  resolveMarketBrief,
  resolveMarketPackForPonte,
  slugsFromSearch,
} from "@/lib/market/resolve";
import {
  combineActivityCnaes,
  normalizeText,
  resolveCnaesFromKeywords,
  resolvePresetCnaes,
} from "@/lib/niches";
import { cnaeMatchesQuery, presetMatchesQuery } from "@/lib/segment-aliases";
import { computeDorDigital, computeGridScore } from "@/lib/scoring";
import {
  canSearchCompanies,
  COMPANY_SEARCH_LIMIT,
  companyNameTokens,
  isCompanyCnpjQuery,
} from "@/lib/data/company-search";
import { municipioListLimit } from "@/lib/municipios";
import { crmMockMethods } from "@/lib/data/crm-mock";
import { catchupMockMethods } from "@/lib/data/catchup-mock";
import { listMemoryBilledCnpjs } from "@/lib/billing/memory-store";
import { digitsCnpj } from "@/lib/crm/bridge";
import {
  compareEnrichmentClaimOrder,
  enrichJobPriority,
  latestEnrichmentJobPerCnpj,
} from "@/lib/enrichment/jobs";
import { matchPresetForCnae } from "@/lib/crm/pipeline-from-cnae";
import { displayCompanyName } from "@/lib/enrichment/company-name";
import type { GridRepo } from "@/lib/data/repo";
import { unsavedIdsToPrune } from "@/lib/searches";
import { callStreak, saoPauloDay } from "@/lib/call-stats";
import { DEFAULT_CALL_GOAL, DEFAULT_MEETING_MINUTES } from "@/lib/pilot-profile";
import type { SearchJob } from "@/lib/search-jobs";
import { SEARCH_JOB_DONE_REUSE_MINUTES, SEARCH_JOB_LIVE_REUSE_MINUTES, SEARCH_JOB_STALE_RUNNING_SECONDS } from "@/lib/search-jobs";
import type {
  CompanySearchHit,
  ContactInfo,
  GridRow,
  LeadDossier,
  LeadEnrichment,
  LeadStatus,
  NextCallLead,
  Profile,
  RefCnae,
  RefMunicipio,
  ScoreProfile,
  Search,
  SearchFilters,
  SharedPhoneVerdict,
} from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/types";
import { SEARCH_CANDIDATE_CAP } from "@/lib/data/establishments-search-sql";
import { cachedCandidateCnpjs } from "@/lib/cache/count-cache";

const COUNT_CAP = 10000;
const RESULT_CAP = 1000;

type StoreIndexes = {
  companyByBasico: Map<string, MockStore["companies"][number]>;
  estByCnpj: Map<string, MockStore["establishments"][number]>;
  partnersByBasico: Map<string, MockStore["partners"]>;
  munById: Map<number, MockStore["ref_municipio"][number]>;
  cnaeByCodigo: Map<string, MockStore["ref_cnae"][number]>;
  phoneUsage: Map<string, number>;
  phoneVerdict: Map<string, SharedPhoneVerdict>;
  emailUsage: Map<string, number>;
  addressUsage: Map<string, number>;
  simplesByBasico: Map<string, MockStore["simples_nacional"][number]>;
};

const indexCache = new WeakMap<MockStore, StoreIndexes>();
const cnaeCountCache = new WeakMap<MockStore, Map<string, Map<string, number>>>();

function getIndexes(store: MockStore): StoreIndexes {
  const cached = indexCache.get(store);
  if (cached) return cached;

  const partnersByBasico = new Map<string, MockStore["partners"]>();
  for (const p of store.partners) {
    const list = partnersByBasico.get(p.cnpj_basico) ?? [];
    list.push(p);
    partnersByBasico.set(p.cnpj_basico, list);
  }

  const idx: StoreIndexes = {
    companyByBasico: new Map(store.companies.map((c) => [c.cnpj_basico, c])),
    estByCnpj: new Map(store.establishments.map((e) => [e.cnpj, e])),
    partnersByBasico,
    munById: new Map(store.ref_municipio.map((m) => [m.id, m])),
    cnaeByCodigo: new Map(store.ref_cnae.map((c) => [c.codigo, c])),
    phoneUsage: new Map(
      store.phone_usage.map((p) => [`${p.ddd1}|${p.telefone1}`, p.qtd_empresas]),
    ),
    phoneVerdict: new Map(
      store.phone_verdict.map((p) => [`${p.ddd1}|${p.telefone1}`, p.verdict]),
    ),
    emailUsage: new Map(
      store.email_usage.map((e) => [e.email.toLowerCase(), e.qtd_empresas]),
    ),
    addressUsage: new Map(
      store.address_usage.map((a) => [
        `${a.cep}|${a.logradouro}|${a.numero}`,
        a.qtd_empresas,
      ]),
    ),
    simplesByBasico: new Map(
      store.simples_nacional.map((s) => [s.cnpj_basico, s]),
    ),
  };
  indexCache.set(store, idx);
  return idx;
}

function cnaeCountsForUfs(store: MockStore, ufs: string[]): Map<string, number> {
  let byKey = cnaeCountCache.get(store);
  if (!byKey) {
    byKey = new Map();
    cnaeCountCache.set(store, byKey);
  }
  const key = [...ufs].sort().join(",");
  const hit = byKey.get(key);
  if (hit) return hit;

  const map = new Map<string, number>();
  for (const e of store.establishments) {
    if (ufs.length && !ufs.includes(e.uf)) continue;
    map.set(e.cnae_principal, (map.get(e.cnae_principal) ?? 0) + 1);
  }
  byKey.set(key, map);
  return map;
}

function randomId(): string {
  return crypto.randomUUID();
}

/** Resolve which CNAE codes the search allows. null = no activity filter. */
function resolveAllowedCnaes(
  store: MockStore,
  filters: SearchFilters,
): Set<string> | null {
  let scoped: Set<string> | null = null;

  if (filters.segmentIds.length) {
    const codes = new Set<string>();
    for (const id of filters.segmentIds) {
      const preset = store.niche_presets.find((p) => p.id === id);
      if (!preset) continue;
      for (const c of resolvePresetCnaes(
        preset,
        store.niche_preset_cnaes,
        store.ref_cnae,
      )) {
        codes.add(c);
      }
    }
    scoped = codes.size ? codes : new Set(["__none__"]);
  } else if (filters.intentQuery && filters.intentQuery.trim().length >= 2) {
    const matched: RefCnae[] = store.ref_cnae.filter((c) =>
      cnaeMatchesQuery(c.codigo, c.descricao, filters.intentQuery!),
    );
    for (const p of store.niche_presets) {
      if (!p.parent_id) continue;
      if (presetMatchesQuery(p, filters.intentQuery)) {
        matched.push(
          ...resolveCnaesFromKeywords(p.keywords, p.exclusoes, store.ref_cnae),
        );
      }
    }
    const codes = new Set(matched.map((c) => c.codigo));
    scoped = codes.size ? codes : new Set(["__none__"]);
  } else if (filters.presetId) {
    const preset = store.niche_presets.find((p) => p.id === filters.presetId);
    if (preset) {
      const codes = resolvePresetCnaes(
        preset,
        store.niche_preset_cnaes,
        store.ref_cnae,
      );
      scoped = codes.length ? new Set(codes) : new Set(["__none__"]);
    }
  }

  return combineActivityCnaes(filters.cnaes, scoped);
}

function phoneVerdictOf(
  store: MockStore,
  ddd: string | null,
  tel: string | null,
): SharedPhoneVerdict {
  if (!ddd || !tel) return "proprio";
  return getIndexes(store).phoneVerdict.get(`${ddd}|${tel}`) ?? "proprio";
}

function isEnrichmentFresh(row: LeadEnrichment | undefined): boolean {
  return isEnrichmentComplete(row);
}

function userOwnsAudit(
  store: MockStore,
  userId: string,
  cnpj: string,
  searchId?: string,
): boolean {
  const digits = digitsCnpj(cnpj);
  if (
    store.billed_cnpjs.some(
      (row) =>
        row.profile_id === userId &&
        row.kind === "enrich" &&
        digitsCnpj(row.cnpj) === digits,
    )
  ) {
    return true;
  }
  if (listMemoryBilledCnpjs(userId, "enrich").some((c) => digitsCnpj(c) === digits)) {
    return true;
  }
  const job = [...store.enrichment_jobs]
    .reverse()
    .find(
      (j) =>
        digitsCnpj(j.cnpj) === digits &&
        (j.requested_by === userId || (searchId != null && j.search_id === searchId)),
    );
  return job?.status === "done" || job?.status === "skipped";
}

function phoneUsageCount(store: MockStore, ddd: string | null, tel: string | null): number {
  if (!ddd || !tel) return 0;
  return getIndexes(store).phoneUsage.get(`${ddd}|${tel}`) ?? 1;
}

function emailUsageCount(store: MockStore, email: string | null): number {
  if (!email) return 0;
  return getIndexes(store).emailUsage.get(email.toLowerCase()) ?? 1;
}

function addressUsageCount(
  store: MockStore,
  cep: string | null,
  logradouro: string | null,
  numero: string | null,
): number {
  if (!cep || !logradouro || !numero) return 0;
  return (
    getIndexes(store).addressUsage.get(`${cep}|${logradouro}|${numero}`) ?? 1
  );
}

function buildContacts(
  store: MockStore,
  cnpj: string,
  ddd1: string | null,
  tel1: string | null,
  ddd2: string | null,
  tel2: string | null,
): ContactInfo[] {
  const contacts: ContactInfo[] = [];
  const push = (ddd: string | null, tel: string | null) => {
    if (!ddd || !tel) return;
    const qtd = phoneUsageCount(store, ddd, tel);
    const verdict = phoneVerdictOf(store, ddd, tel);
    const { seal, label } = phoneSealFromUsage(qtd, cnpj + tel, verdict);
    contacts.push({
      ddd,
      telefone: tel,
      seal,
      sharedCount: qtd,
      sharedVerdict: verdict,
      label,
      source: seal === "ATUALIZADO" ? "site" : "receita",
    });
  };
  push(ddd1, tel1);
  push(ddd2, tel2);
  contacts.sort((a, b) => sealRank(b.seal) - sealRank(a.seal));
  return contacts;
}

function matchesFilters(store: MockStore, filters: SearchFilters) {
  const idx = getIndexes(store);
  const optOutDocs = new Set(store.opt_outs.map((o) => o.documento.replace(/\D/g, "")));
  const allowedCnaes = resolveAllowedCnaes(store, filters);
  const nowYearCutoff = filters.idadeMinimaAnos;

  return store.establishments.filter((est) => {
    if (optOutDocs.has(est.cnpj) || optOutDocs.has(est.cnpj_basico)) return false;

    if (filters.cnpjs?.length) {
      const wanted = new Set(
        filters.cnpjs.map((c) => c.replace(/\D/g, "").padStart(14, "0")),
      );
      if (!wanted.has(est.cnpj)) return false;
    }

    if (allowedCnaes && !allowedCnaes.has(est.cnae_principal)) {
      return false;
    }
    if (filters.ufs.length && !filters.ufs.includes(est.uf)) return false;
    if (
      filters.municipioIds.length &&
      !filters.municipioIds.includes(est.municipio_id)
    ) {
      return false;
    }
    if (filters.soMatriz && !est.is_matriz) return false;

    const company = idx.companyByBasico.get(est.cnpj_basico);
    if (!company) return false;

    if (filters.portes.length && company.porte && !filters.portes.includes(company.porte)) {
      return false;
    }
    if (
      filters.capitalMin !== null &&
      (company.capital_social ?? 0) < filters.capitalMin
    ) {
      return false;
    }
    if (
      filters.capitalMax !== null &&
      (company.capital_social ?? 0) > filters.capitalMax
    ) {
      return false;
    }

    if (nowYearCutoff > 0) {
      const years = yearsSince(est.data_inicio);
      if (years === null || years < nowYearCutoff) return false;
    }

    const simples = idx.simplesByBasico.get(est.cnpj_basico);
    if (filters.excluirSimples && simples?.opcao_simples) return false;

    if (filters.ocultarTelefonesCompartilhados) {
      const verdict = phoneVerdictOf(store, est.ddd1, est.telefone1);
      if (verdict === "contabilidade") return false;
    }

    if (filters.soEnriquecidas) {
      const enr = store.lead_enrichment.find((r) => r.cnpj === est.cnpj);
      if (!isEnrichmentFresh(enr)) return false;
    }

    if (filters.ocultarEmailsGratuitos && isFreeEmail(est.email)) return false;

    if (filters.ocultarEnderecosCompartilhados) {
      const aq = addressUsageCount(store, est.cep, est.logradouro, est.numero);
      if (aq >= 5) return false;
    }

    if (filters.exigirEmailProprio && !isOwnDomainEmail(est.email)) return false;

    if (filters.exigirDecisor) {
      const partners = idx.partnersByBasico.get(est.cnpj_basico) ?? [];
      if (!pickDecisor(partners, store.ref_qualificacao)) return false;
    }

    return true;
  });
}

function scoreProfileForFilters(
  store: MockStore,
  filters: SearchFilters,
): ScoreProfile {
  const id = filters.segmentIds[0] ?? filters.presetId;
  if (id) {
    const preset = store.niche_presets.find((p) => p.id === id);
    if (preset) return preset.perfil_score;
  }
  return "b2c_local";
}

function scoreEstablishment(
  store: MockStore,
  est: ReturnType<typeof matchesFilters>[number],
  filters: SearchFilters,
): { score: number; contacts: ContactInfo[]; decisorNome: string | null } {
  const idx = getIndexes(store);
  const company = idx.companyByBasico.get(est.cnpj_basico)!;
  const partners = idx.partnersByBasico.get(est.cnpj_basico) ?? [];
  const decisor = pickDecisor(partners, store.ref_qualificacao);
  const contacts = buildContacts(
    store,
    est.cnpj,
    est.ddd1,
    est.telefone1,
    est.ddd2,
    est.telefone2,
  );
  const primary = contacts[0];
  const profile = scoreProfileForFilters(store, filters);
  const allowed = resolveAllowedCnaes(store, filters);
  const enrichment = store.lead_enrichment.find((r) => r.cnpj === est.cnpj);
  const fresh = isEnrichmentFresh(enrichment);
  const includeDor = fresh && !!enrichment;
  const dorDigitalRaw = includeDor ? computeDorDigital(profile, enrichment!) : 0;

  const score = computeGridScore({
    profile,
    cnaeMatch: allowed ? allowed.has(est.cnae_principal) : true,
    porteCompativel:
      !filters.portes.length ||
      (!!company.porte && filters.portes.includes(company.porte)),
    capitalNaFaixa:
      (filters.capitalMin === null ||
        (company.capital_social ?? 0) >= filters.capitalMin) &&
      (filters.capitalMax === null ||
        (company.capital_social ?? 0) <= filters.capitalMax),
    idadeMinimaOk:
      filters.idadeMinimaAnos <= 0 ||
      (yearsSince(est.data_inicio) ?? 0) >= filters.idadeMinimaAnos,
    phoneSeal: primary?.seal ?? "NAO_CONFIRMADO",
    hasWhatsapp: Boolean(enrichment?.whatsapp),
    email: est.email,
    hasDecisor: !!decisor,
    includeDorDigital: includeDor,
    dorDigitalRaw,
  });

  return {
    score,
    contacts,
    decisorNome: decisor?.nome ?? null,
  };
}

function resolveCnaesForPresetSync(presetId: string): string[] {
  const store = getMockStore();
  const preset = store.niche_presets.find((p) => p.id === presetId);
  if (!preset) return [];
  return resolvePresetCnaes(preset, store.niche_preset_cnaes, store.ref_cnae);
}

function countByPresetInRegionSync(presetId: string, ufs: string[]): number {
  const store = getMockStore();
  const preset = store.niche_presets.find((p) => p.id === presetId);
  if (!preset) return 0;
  if (!preset.parent_id) {
    const segments = store.niche_presets.filter((p) => p.parent_id === presetId);
    if (segments.length) {
      return segments.reduce(
        (sum, s) => sum + countByPresetInRegionSync(s.id, ufs),
        0,
      );
    }
  }
  const cnaes = resolveCnaesForPresetSync(presetId);
  if (!cnaes.length) return 0;
  const counts = cnaeCountsForUfs(store, ufs);
  return cnaes.reduce((sum, codigo) => sum + (counts.get(codigo) ?? 0), 0);
}

function dossierOf(cnpj: string, searchId?: string): LeadDossier | null {
  const store = getMockStore();
  const est = store.establishments.find((e) => e.cnpj === cnpj);
  if (!est) return null;
  const company = store.companies.find((c) => c.cnpj_basico === est.cnpj_basico);
  if (!company) return null;

  const enrichment =
    store.lead_enrichment.find((r) => r.cnpj === cnpj && isEnrichmentVisible(r)) ??
    null;
  const search = searchId
    ? store.searches.find((s) => s.id === searchId)
    : undefined;
  const slugs = slugsFromSearch(search?.filtros, store.niche_presets);
  const cnaeDescricao =
    store.ref_cnae.find((c) => c.codigo === est.cnae_principal)?.descricao ??
    "NÃO ENCONTRADO";
  const municipioNome =
    store.ref_municipio.find((m) => m.id === est.municipio_id)?.nome ??
    "NÃO ENCONTRADO";
  const market = resolveMarketBrief({
    ...slugs,
    cnaeDescricao,
    municipioNome,
  });
  const pontePack = resolveMarketPackForPonte({
    ...slugs,
    cnaeDescricao,
    municipioNome,
  });
  const latestJob = [...store.enrichment_jobs]
    .reverse()
    .find((j) => j.cnpj === cnpj);

  let contacts = buildContacts(
    store,
    est.cnpj,
    est.ddd1,
    est.telefone1,
    est.ddd2,
    est.telefone2,
  );
  if (enrichment?.phones.length) {
    contacts = contactsFromEnrichmentPhones(enrichment.phones);
  }

  const partners = store.partners.filter((p) => p.cnpj_basico === est.cnpj_basico);
  const decisorPartner = pickDecisor(partners, store.ref_qualificacao);
  const saved = searchId
    ? store.saved_leads.find((l) => l.search_id === searchId && l.cnpj === cnpj)
    : store.saved_leads.find((l) => l.cnpj === cnpj);
  const email = est.email;
  const emailShared = emailUsageCount(store, email) >= 3;

  return {
    establishment: est,
    company,
    cnaeDescricao,
    municipioNome,
    contacts,
    emailSeal: {
      email,
      shared: emailShared,
      free: isFreeEmail(email),
      accountantHint: hasAccountantDomainHint(email),
    },
    addressSharedCount: addressUsageCount(
      store,
      est.cep,
      est.logradouro,
      est.numero,
    ),
    decisor: decisorPartner
      ? {
          nome: decisorPartner.nome,
          qualificacao: qualificacaoLabel(
            decisorPartner.qualificacao_id,
            store.ref_qualificacao,
          ),
          dataEntrada: decisorPartner.data_entrada,
          faixaEtaria: decisorPartner.faixa_etaria,
        }
      : null,
    socios: toPartnerCards(partners, store.ref_qualificacao),
    gridScore: saved?.grid_score ?? 0,
    gridPosition: saved?.grid_position ?? null,
    status: saved?.status ?? "novo",
    notas: saved?.notas ?? null,
    savedLeadId: saved?.id ?? null,
    enrichment,
    enrichmentJobStatus: latestJob?.status ?? null,
    market,
    goldenMinute: buildGoldenMinute(enrichment, pontePack),
  };
}

export const mockRepo: GridRepo = {
  async getProfile(userId: string) {
    const store = getMockStore();
    const found = store.profiles.find((p) => p.id === userId);
    if (found) return found;
    return store.profiles[0];
  },

  async listPresets() {
    return [...getMockStore().niche_presets].sort((a, b) => a.ordem - b.ordem);
  },

  async listNiches() {
    const presets = await this.listPresets();
    return presets.filter((p) => !p.parent_id);
  },

  async listSegments(nicheId?: string) {
    const presets = await this.listPresets();
    return presets.filter((p) =>
      nicheId ? p.parent_id === nicheId : !!p.parent_id,
    );
  },

  async getPreset(id: string) {
    return getMockStore().niche_presets.find((p) => p.id === id);
  },

  async listPresetCnaes(presetId: string) {
    return getMockStore().niche_preset_cnaes.filter((c) => c.preset_id === presetId);
  },

  async resolveCnaesForPreset(presetId: string) {
    return resolveCnaesForPresetSync(presetId);
  },

  async previewCnaes(filters: {
    segmentIds: string[];
    intentQuery: string | null;
    cnaes: string[];
    ufs: string[];
  }): Promise<Array<RefCnae & { count: number; selected: boolean }>> {
    const store = getMockStore();
    const probe = {
      cnaes: [] as string[],
      presetId: null,
      segmentIds: filters.segmentIds,
      intentQuery: filters.intentQuery,
      cnpjs: [] as string[],
      ufs: filters.ufs ?? [],
      municipioIds: [] as number[],
      portes: [] as string[],
      capitalMin: null,
      capitalMax: null,
      idadeMinimaAnos: 0,
      soMatriz: false,
      excluirSimples: false,
      exigirEmailProprio: false,
      exigirDecisor: false,
      ocultarTelefonesCompartilhados: false,
      ocultarEmailsGratuitos: false,
      ocultarEnderecosCompartilhados: false,
      soEnriquecidas: false,
    } satisfies SearchFilters;

    const allowed = resolveAllowedCnaes(store, probe);
    if (!allowed || allowed.has("__none__")) return [];

    const selected = new Set(filters.cnaes ?? []);
    const counts = cnaeCountsForUfs(store, filters.ufs ?? []);
    return [...allowed]
      .filter((c) => c !== "__none__")
      .map((codigo) => {
        const ref = store.ref_cnae.find((c) => c.codigo === codigo);
        return {
          codigo: ref?.codigo ?? codigo,
          descricao: ref?.descricao ?? "NÃO ENCONTRADO",
          count: counts.get(codigo) ?? 0,
          selected: selected.size ? selected.has(codigo) : false,
        };
      })
      .sort((a, b) => b.count - a.count);
  },

  async searchCnaes(query: string, limit = 30) {
    const store = getMockStore();
    return store.ref_cnae
      .filter((c) => cnaeMatchesQuery(c.codigo, c.descricao, query))
      .slice(0, limit)
      .map((c) => ({
        ...c,
        count: store.establishments.filter((e) => e.cnae_principal === c.codigo)
          .length,
      }));
  },

  async searchCompanies(query, opts) {
    const store = getMockStore();
    const idx = getIndexes(store);
    const q = query.trim();
    if (!canSearchCompanies(q)) return [];
    const limit = opts?.limit ?? COMPANY_SEARCH_LIMIT;
    const ufs = opts?.ufs ?? [];
    const soMatriz = Boolean(opts?.soMatriz);
    const digits = q.replace(/\D/g, "");
    const nq = normalizeText(q);
    const cnpjQuery = isCompanyCnpjQuery(q);
    const ranked: Array<CompanySearchHit & { prefix: boolean; matriz: boolean }> =
      [];
    for (const est of store.establishments) {
      if (ufs.length && !ufs.includes(est.uf)) continue;
      if (soMatriz && !est.is_matriz) continue;
      const company = idx.companyByBasico.get(est.cnpj_basico);
      if (!company) continue;
      const razao = normalizeText(company.razao_social);
      const fantasia = normalizeText(est.nome_fantasia ?? "");
      const byCnpj =
        cnpjQuery &&
        (est.cnpj.includes(digits) || est.cnpj_basico.includes(digits));
      const prefix = razao.startsWith(nq) || fantasia.startsWith(nq);
      const tokens = companyNameTokens(q);
      const byName =
        !cnpjQuery &&
        tokens.length > 0 &&
        tokens.every((t) => razao.includes(t) || fantasia.includes(t));
      if (!byCnpj && !byName) continue;
      const mun = idx.munById.get(est.municipio_id);
      const cnae = idx.cnaeByCodigo.get(est.cnae_principal);
      const partners = idx.partnersByBasico.get(est.cnpj_basico) ?? [];
      const decisor = pickDecisor(partners, store.ref_qualificacao);
      ranked.push({
        cnpj: est.cnpj,
        razaoSocial: company.razao_social,
        nomeFantasia: est.nome_fantasia,
        municipio: mun?.nome ?? "NÃO ENCONTRADO",
        uf: est.uf,
        cnaeCodigo: est.cnae_principal,
        cnaeDescricao: cnae?.descricao ?? "NÃO ENCONTRADO",
        telefone:
          est.ddd1 && est.telefone1 ? `${est.ddd1}${est.telefone1}` : null,
        decisorNome: decisor?.nome ?? null,
        prefix: cnpjQuery || prefix,
        matriz: est.is_matriz,
      });
    }
    ranked.sort(
      (a, b) =>
        Number(b.prefix) - Number(a.prefix) || Number(b.matriz) - Number(a.matriz),
    );
    return ranked.slice(0, limit).map(({ prefix: _p, matriz: _m, ...hit }) => hit);
  },

  async listMunicipios(ufs: string[], query = "") {
    const store = getMockStore();
    let list = !ufs.length
      ? store.ref_municipio
      : store.ref_municipio.filter((m) => ufs.includes(m.uf));
    if (query.trim().length >= 1) {
      const q = normalizeText(query);
      list = list.filter((m) => normalizeText(m.nome).includes(q));
    }
    const cap = municipioListLimit(ufs.length);
    return cap == null ? list : list.slice(0, cap);
  },

  async listCapitals(ufs: string[]) {
    const capitals: Record<string, string> = {
      AC: "Rio Branco", AL: "Maceió", AP: "Macapá", AM: "Manaus", BA: "Salvador",
      CE: "Fortaleza", DF: "Brasília", ES: "Vitória", GO: "Goiânia", MA: "São Luís",
      MT: "Cuiabá", MS: "Campo Grande", MG: "Belo Horizonte", PA: "Belém",
      PB: "João Pessoa", PR: "Curitiba", PE: "Recife", PI: "Teresina",
      RJ: "Rio de Janeiro", RN: "Natal", RS: "Porto Alegre", RO: "Porto Velho",
      RR: "Boa Vista", SC: "Florianópolis", SP: "São Paulo", SE: "Aracaju", TO: "Palmas",
    };
    const store = getMockStore();
    const target = ufs.length ? ufs : Object.keys(capitals);
    return target
      .map((uf) => {
        const name = capitals[uf];
        return store.ref_municipio.find(
          (m) => m.uf === uf && normalizeText(m.nome) === normalizeText(name ?? ""),
        );
      })
      .filter((m): m is RefMunicipio => !!m);
  },

  async countByPresetInRegion(presetId: string, ufs: string[]) {
    return countByPresetInRegionSync(presetId, ufs);
  },

  async countPresetsInRegion(presetIds: string[], ufs: string[]) {
    const out: Record<string, number> = {};
    for (const id of presetIds) {
      out[id] = countByPresetInRegionSync(id, ufs);
    }
    return out;
  },

  async count(filters: SearchFilters, mode = "full") {
    const store = getMockStore();
    const idx = getIndexes(store);
    const matched = matchesFilters(store, filters);
    const capped = matched.length > COUNT_CAP;
    const slice = matched.slice(0, COUNT_CAP);

    const munCounts = new Map<number, number>();
    let comTelefone = 0;
    let comEmail = 0;
    let comDecisor = 0;

    for (const est of slice) {
      munCounts.set(est.municipio_id, (munCounts.get(est.municipio_id) ?? 0) + 1);
      if (mode === "full") {
        if (est.telefone1) comTelefone += 1;
        if (est.email) comEmail += 1;
        const partners = idx.partnersByBasico.get(est.cnpj_basico) ?? [];
        if (pickDecisor(partners, store.ref_qualificacao)) comDecisor += 1;
      }
    }

    const porMunicipio = [...munCounts.entries()]
      .map(([municipio_id, total]) => {
        const mun = store.ref_municipio.find((m) => m.id === municipio_id);
        return {
          municipio_id,
          nome: mun?.nome ?? "NÃO ENCONTRADO",
          uf: mun?.uf ?? "",
          total,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      total: capped ? COUNT_CAP : matched.length,
      capped,
      comTelefone: mode === "full" ? comTelefone : 0,
      comEmail: mode === "full" ? comEmail : 0,
      comDecisor: mode === "full" ? comDecisor : 0,
      porMunicipio,
      ...(mode === "full" &&
      !capped &&
      matched.length <= SEARCH_CANDIDATE_CAP
        ? { cnpjs: slice.map((est) => est.cnpj) }
        : {}),
    };
  },

  async hasCachedSearchCandidates(filters) {
    const result = await this.count(filters, "full");
    return cachedCandidateCnpjs(result, SEARCH_CANDIDATE_CAP) != null;
  },

  async recordDoneSearchJob(userId, nome, filters, searchId) {
    const store = getMockStore();
    const job: SearchJob = {
      id: randomId(),
      user_id: userId,
      nome,
      filtros: filters,
      status: "done",
      search_id: searchId,
      error: null,
      attempts: 0,
      locked_at: null,
      created_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    };
    store.search_jobs.push(job);
    return job;
  },

  async runSearch(userId: string, nome: string, filters: SearchFilters) {
    await this.pruneUnsavedSearches(userId, { incoming: 1 });
    const store = getMockStore();
    const matched = matchesFilters(store, filters).slice(0, RESULT_CAP);
    const scored = matched
      .map((est) => {
        const { score } = scoreEstablishment(store, est, filters);
        return { est, score };
      })
      .sort((a, b) => b.score - a.score);

    const search: Search = {
      id: randomId(),
      user_id: userId,
      nome,
      filtros: filters,
      total_found: scored.length,
      created_at: new Date().toISOString(),
      saved: false,
    };
    store.searches.unshift(search);

    scored.forEach((row, idx) => {
      store.saved_leads.push({
        id: randomId(),
        search_id: search.id,
        user_id: userId,
        cnpj: row.est.cnpj,
        grid_score: row.score,
        grid_position: idx + 1,
        enrichment: null,
        status: "novo",
        notas: null,
        created_at: new Date().toISOString(),
      });
    });

    return search;
  },

  async enqueueSearchJob(userId, nome, filters) {
    const store = getMockStore();
    const job: SearchJob = {
      id: randomId(),
      user_id: userId,
      nome,
      filtros: filters,
      status: "pending",
      search_id: null,
      error: null,
      attempts: 0,
      locked_at: null,
      created_at: new Date().toISOString(),
      finished_at: null,
    };
    store.search_jobs.push(job);
    return job;
  },

  async findReusableSearchJob(userId, filters) {
    const key = JSON.stringify(filters);
    const store = getMockStore();
    const liveAfter = Date.now() - SEARCH_JOB_LIVE_REUSE_MINUTES * 60 * 1000;
    const doneAfter = Date.now() - SEARCH_JOB_DONE_REUSE_MINUTES * 60 * 1000;
    const ranked = [...store.search_jobs]
      .filter((j) => j.user_id === userId && JSON.stringify(j.filtros) === key)
      .filter((j) => {
        if (j.status === "pending" || j.status === "running") {
          return Date.parse(j.created_at) > liveAfter;
        }
        if (j.status !== "done" || !j.search_id || !j.finished_at) return false;
        return Date.parse(j.finished_at) > doneAfter;
      })
      .sort((a, b) => {
        const liveA = a.status === "pending" || a.status === "running" ? 0 : 1;
        const liveB = b.status === "pending" || b.status === "running" ? 0 : 1;
        if (liveA !== liveB) return liveA - liveB;
        return b.created_at.localeCompare(a.created_at);
      });
    return ranked[0] ?? null;
  },

  async getSearchJob(id, userId) {
    return (
      getMockStore().search_jobs.find((j) => j.id === id && j.user_id === userId) ??
      null
    );
  },

  async countSearchJobsAhead(job) {
    if (job.status !== "pending") return 0;
    return getMockStore().search_jobs.filter(
      (j) =>
        j.status === "pending" &&
        j.created_at < job.created_at,
    ).length;
  },

  async claimSearchJob() {
    const store = getMockStore();
    const stale = Date.now() - 10 * 60 * 1000;
    const job = store.search_jobs.find(
      (j) =>
        j.status === "pending" ||
        (j.status === "running" &&
          j.locked_at &&
          new Date(j.locked_at).getTime() < stale),
    );
    if (!job) return null;
    job.status = "running";
    job.locked_at = new Date().toISOString();
    job.attempts += 1;
    return job;
  },

  async claimOwnedSearchJob(id, userId) {
    const store = getMockStore();
    const stale = Date.now() - SEARCH_JOB_STALE_RUNNING_SECONDS * 1000;
    const job = store.search_jobs.find((j) => j.id === id && j.user_id === userId);
    if (!job) return null;
    const staleRunning =
      job.status === "running" &&
      job.locked_at &&
      new Date(job.locked_at).getTime() < stale;
    if (job.status !== "pending" && !staleRunning) return null;
    job.status = "running";
    job.locked_at = new Date().toISOString();
    job.attempts += 1;
    return job;
  },

  async finishSearchJob(id, patch) {
    const job = getMockStore().search_jobs.find((j) => j.id === id);
    if (!job) return;
    job.status = patch.status;
    if (patch.search_id !== undefined) job.search_id = patch.search_id;
    if (patch.error !== undefined) job.error = patch.error;
    job.finished_at = new Date().toISOString();
  },

  async getSearch(searchId: string) {
    return getMockStore().searches.find((s) => s.id === searchId);
  },

  async listSearches(userId, opts) {
    const rows = getMockStore()
      .searches.filter((s) => s.user_id === userId && s.saved)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    return opts?.limit != null ? rows.slice(0, opts.limit) : rows;
  },

  async listRecentSearches(userId, opts) {
    const rows = getMockStore()
      .searches.filter((s) => {
        if (s.user_id !== userId) return false;
        if (opts?.saved != null) return s.saved === opts.saved;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    return opts?.limit != null ? rows.slice(0, opts.limit) : rows;
  },

  async saveSearch(
    searchId: string,
    patch: { nome?: string; saved?: boolean },
  ) {
    const search = getMockStore().searches.find((s) => s.id === searchId);
    if (!search) return undefined;
    if (patch.nome != null && patch.nome.trim()) {
      search.nome = patch.nome.trim();
    }
    if (patch.saved != null) {
      search.saved = patch.saved;
    }
    if (patch.saved === false) {
      await this.pruneUnsavedSearches(search.user_id, { keepId: searchId });
    }
    return search;
  },

  async pruneUnsavedSearches(userId, opts) {
    const unsaved = await this.listRecentSearches(userId, { saved: false });
    const ids = unsavedIdsToPrune(unsaved, opts);
    for (const id of ids) {
      await this.deleteSearch(id);
    }
    return ids;
  },

  async deleteSearch(searchId: string) {
    const store = getMockStore();
    const idx = store.searches.findIndex((s) => s.id === searchId);
    if (idx === -1) return false;
    store.searches.splice(idx, 1);
    store.saved_leads = store.saved_leads.filter((l) => l.search_id !== searchId);
    return true;
  },

  async deleteSavedLead(searchId: string, cnpj: string) {
    const store = getMockStore();
    const search = store.searches.find((s) => s.id === searchId);
    if (!search) return false;
    const digits = digitsCnpj(cnpj);
    const before = store.saved_leads.length;
    store.saved_leads = store.saved_leads.filter(
      (l) => !(l.search_id === searchId && digitsCnpj(l.cnpj) === digits),
    );
    if (store.saved_leads.length === before) return false;
    const remaining = store.saved_leads
      .filter((l) => l.search_id === searchId)
      .sort((a, b) => a.grid_position - b.grid_position);
    remaining.forEach((lead, i) => {
      lead.grid_position = i + 1;
    });
    search.total_found = remaining.length;
    return true;
  },

  async createSavedCnpjSearch(userId: string, cnpj: string, nome?: string) {
    const padded = digitsCnpj(cnpj);
    const hits = await this.searchCompanies(padded, { limit: 1 });
    const hit = hits[0];
    if (!hit) return null;
    const store = getMockStore();
    const preset = matchPresetForCnae(
      hit.cnaeCodigo,
      store.niche_presets,
      store.niche_preset_cnaes,
      store.ref_cnae,
    );
    const filters: SearchFilters = {
      ...DEFAULT_FILTERS,
      cnpjs: [padded],
      ufs: hit.uf ? [hit.uf] : [],
      segmentIds: preset ? [preset.id] : [],
      intentQuery: preset ? null : hit.cnaeDescricao || null,
    };
    const search: Search = {
      id: randomId(),
      user_id: userId,
      nome: nome?.trim() || displayCompanyName(hit.nomeFantasia, hit.razaoSocial),
      filtros: filters,
      total_found: 1,
      created_at: new Date().toISOString(),
      saved: true,
    };
    store.searches.unshift(search);
    store.saved_leads.push({
      id: randomId(),
      search_id: search.id,
      user_id: userId,
      cnpj: padded,
      grid_score: 0,
      grid_position: 1,
      enrichment: null,
      status: "novo",
      notas: null,
      created_at: search.created_at,
    });
    return search;
  },

  async listCompanyBriefs(cnpjs: string[]) {
    const store = getMockStore();
    const idx = getIndexes(store);
    const out = [];
    for (const raw of cnpjs) {
      const cnpj = digitsCnpj(raw);
      const est = idx.estByCnpj.get(cnpj);
      if (!est) continue;
      const company = idx.companyByBasico.get(est.cnpj_basico);
      if (!company) continue;
      const partners = idx.partnersByBasico.get(est.cnpj_basico) ?? [];
      const decisor = pickDecisor(partners, store.ref_qualificacao);
      out.push({
        cnpj: est.cnpj,
        razaoSocial: company.razao_social,
        nomeFantasia: est.nome_fantasia,
        ddd1: est.ddd1,
        telefone1: est.telefone1,
        decisorNome: decisor?.nome ?? null,
      });
    }
    return out;
  },

  async listGridRows(searchId: string, cursor = 0, limit = 50) {
    const store = getMockStore();
    const search = store.searches.find((s) => s.id === searchId);
    if (!search) return { rows: [], nextCursor: null, total: 0, unaudited: 0 };

    const leads = store.saved_leads
      .filter((l) => l.search_id === searchId)
      .sort((a, b) => a.grid_position - b.grid_position);

    const idx = getIndexes(store);
    const unaudited = leads.filter(
      (l) => !userOwnsAudit(store, search.user_id, l.cnpj, searchId),
    ).length;
    const page = leads.slice(cursor, cursor + limit);
    const rows: GridRow[] = page.map((lead) => {
      const est = idx.estByCnpj.get(lead.cnpj)!;
      const company = idx.companyByBasico.get(est.cnpj_basico)!;
      const contacts = buildContacts(
        store,
        est.cnpj,
        est.ddd1,
        est.telefone1,
        est.ddd2,
        est.telefone2,
      );
      const primary = contacts[0];
      const partners = idx.partnersByBasico.get(est.cnpj_basico) ?? [];
      const decisor = pickDecisor(partners, store.ref_qualificacao);
      const mun = idx.munById.get(est.municipio_id);
      const cnae = idx.cnaeByCodigo.get(est.cnae_principal);
      const job = [...store.enrichment_jobs]
        .reverse()
        .find((j) => j.cnpj === lead.cnpj && j.search_id === searchId);
      const enrichment = store.lead_enrichment.find((e) => e.cnpj === lead.cnpj);
      const hasAudit = userOwnsAudit(store, search.user_id, lead.cnpj, searchId);
      const completeAudit = hasAudit && isEnrichmentFresh(enrichment);
      const phone = overlayGridPhone(
        {
          telefone: primary ? `${primary.ddd}${primary.telefone}` : null,
          seal: primary?.seal ?? "NAO_CONFIRMADO",
          sharedCount: primary?.sharedCount ?? 0,
          sharedVerdict: primary?.sharedVerdict,
        },
        completeAudit ? enrichment : null,
      );

      return {
        cnpj: est.cnpj,
        razaoSocial: company.razao_social,
        nomeFantasia: est.nome_fantasia,
        municipio: mun?.nome ?? "NÃO ENCONTRADO",
        uf: est.uf,
        cnaeCodigo: est.cnae_principal,
        cnaeDescricao: cnae?.descricao ?? "NÃO ENCONTRADO",
        telefone: phone.telefone,
        seal: phone.seal,
        sharedCount: phone.sharedCount,
        sharedVerdict: phone.sharedVerdict,
        decisorNome: decisor?.nome ?? null,
        porte: company.porte,
        email: est.email?.trim() || null,
        gridScore: lead.grid_score ?? 0,
        gridPosition: lead.grid_position ?? 0,
        enrichmentStatus: job?.status ?? (completeAudit ? "done" : null),
        hasAudit,
      };
    });

    const next = cursor + limit < leads.length ? cursor + limit : null;
    return { rows, nextCursor: next, total: leads.length, unaudited };
  },

  async listUnauditedCnpjs(searchId: string, opts?: { limit?: number }) {
    const store = getMockStore();
    const search = store.searches.find((s) => s.id === searchId);
    if (!search) return [];
    const cnpjs = store.saved_leads
      .filter((l) => l.search_id === searchId)
      .sort((a, b) => a.grid_position - b.grid_position)
      .filter((l) => !userOwnsAudit(store, search.user_id, l.cnpj, searchId))
      .map((l) => l.cnpj);
    if (opts?.limit != null && opts.limit > 0) return cnpjs.slice(0, opts.limit);
    return cnpjs;
  },

  async getDossier(cnpj: string, searchId?: string) {
    return dossierOf(cnpj, searchId);
  },

  async updateLead(
    savedLeadId: string,
    patch: { status?: LeadStatus; notas?: string },
  ) {
    const lead = getMockStore().saved_leads.find((l) => l.id === savedLeadId);
    if (!lead) return;
    if (patch.status) lead.status = patch.status;
    if (patch.notas !== undefined) lead.notas = patch.notas;
    if (patch.status === "ligando") {
      await this.recordCallEvent(lead.user_id, {
        cnpj: lead.cnpj,
        savedLeadId: lead.id,
        source: "status",
      });
    }
  },

  async updateProfile(userId: string, patch: Partial<Profile>) {
    const profile = await this.getProfile(userId);
    Object.assign(profile, patch);
    if (profile.duracao_reuniao == null) {
      profile.duracao_reuniao = DEFAULT_MEETING_MINUTES;
    }
    if (profile.meta_ligacoes_dia == null) {
      profile.meta_ligacoes_dia = DEFAULT_CALL_GOAL;
    }
    return profile;
  },

  async recordCallEvent(userId, input) {
    const store = getMockStore();
    const today = saoPauloDay(new Date());
    const dup = store.call_events.find(
      (e) =>
        e.user_id === userId &&
        e.cnpj === input.cnpj &&
        saoPauloDay(e.created_at) === today,
    );
    if (dup) return false;
    store.call_events.push({
      id: randomId(),
      user_id: userId,
      cnpj: input.cnpj,
      saved_lead_id: input.savedLeadId ?? null,
      source: input.source,
      created_at: new Date().toISOString(),
    });
    return true;
  },

  async findNextCallLead(userId, searchId?: string | null): Promise<NextCallLead | null> {
    const store = getMockStore();
    const searches = store.searches
      .filter((s) => s.user_id === userId && s.saved)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const ordered =
      searchId && searches.some((s) => s.id === searchId)
        ? [
            ...searches.filter((s) => s.id === searchId),
            ...searches.filter((s) => s.id !== searchId),
          ]
        : searches;
    for (const search of ordered) {
      const lead = store.saved_leads
        .filter((l) => l.search_id === search.id && l.status === "novo")
        .sort((a, b) => a.grid_position - b.grid_position)[0];
      if (!lead) continue;
      const est = store.establishments.find((e) => e.cnpj === lead.cnpj);
      const company = est
        ? store.companies.find((c) => c.cnpj_basico === est.cnpj_basico)
        : undefined;
      return {
        cnpj: lead.cnpj,
        searchId: search.id,
        nome: est?.nome_fantasia || company?.razao_social || lead.cnpj,
        gridPosition: lead.grid_position,
      };
    }
    return null;
  },

  async getPilotStats(userId, opts) {
    const profile = await this.getProfile(userId);
    const events = getMockStore().call_events.filter((e) => e.user_id === userId);
    const stamps = events.map((e) => e.created_at);
    const today = saoPauloDay(new Date());
    return {
      hoje: stamps.filter((iso) => saoPauloDay(iso) === today).length,
      meta: profile.meta_ligacoes_dia || DEFAULT_CALL_GOAL,
      sequencia: callStreak(stamps),
      proximaFicha:
        opts?.includeNext === false ? null : await this.findNextCallLead(userId),
    };
  },

  async saveNicheCuradoria(
    presetId: string,
    rows: Array<{ cnae: string; incluido: boolean }>,
  ) {
    const store = getMockStore();
    store.niche_preset_cnaes = store.niche_preset_cnaes.filter(
      (c) => c.preset_id !== presetId,
    );
    for (const row of rows) {
      store.niche_preset_cnaes.push({
        preset_id: presetId,
        cnae: row.cnae,
        incluido: row.incluido,
      });
    }
    const preset = store.niche_presets.find((p) => p.id === presetId);
    if (preset) preset.curado = true;
  },

  async listRefCnaes() {
    return getMockStore().ref_cnae;
  },

  async getAllLeadsForExport(searchId: string) {
    const store = getMockStore();
    const leads = store.saved_leads
      .filter((l) => l.search_id === searchId)
      .sort((a, b) => a.grid_position - b.grid_position);
    return leads
      .map((l) => dossierOf(l.cnpj, searchId))
      .filter((d): d is LeadDossier => !!d);
  },

  async addOptOut(documento: string, motivo: string | null) {
    getMockStore().opt_outs.push({
      id: randomId(),
      documento: documento.replace(/\D/g, ""),
      motivo,
      created_at: new Date().toISOString(),
    });
  },

  async isOptedOut(cnpj: string) {
    const digits = cnpj.replace(/\D/g, "");
    return getMockStore().opt_outs.some(
      (o) => o.documento.replace(/\D/g, "") === digits || digits.startsWith(o.documento.replace(/\D/g, "")),
    );
  },

  async enqueueEnrichment(input) {
    const classified = await this.classifyEnrichmentCnpjs(
      input.cnpjs,
      input.userId,
    );
    const store = getMockStore();
    let queued = 0;
    const unique = [...new Set(input.cnpjs)];
    for (const cnpj of unique) {
      if (await this.isOptedOut(cnpj)) continue;
      const fresh = store.lead_enrichment.find(
        (e) => e.cnpj === cnpj && isEnrichmentFresh(e),
      );
      const active = store.enrichment_jobs.find(
        (j) =>
          j.cnpj === cnpj && (j.status === "pending" || j.status === "running"),
      );
      if (active) continue;
      const id =
        (store.enrichment_jobs.reduce((m, j) => Math.max(m, j.id), 0) || 0) + 1;
      const skipFresh = Boolean(fresh) && !input.force;
      store.enrichment_jobs.push({
        id,
        cnpj,
        requested_by: input.userId,
        search_id: input.searchId,
        status: skipFresh ? "skipped" : "pending",
        attempts: 0,
        last_error: null,
        locked_at: null,
        created_at: new Date().toISOString(),
        finished_at: skipFresh ? new Date().toISOString() : null,
        payload: input.payload ?? null,
        priority: enrichJobPriority(input.priority === true),
      });
      if (!skipFresh) queued += 1;
    }
    return { queued, skippedOptOut: classified.skippedOptOut };
  },

  async listEnrichmentJobs(searchId: string) {
    return latestEnrichmentJobPerCnpj(
      getMockStore().enrichment_jobs.filter((j) => j.search_id === searchId),
    );
  },

  async getEnrichment(cnpj: string) {
    return (
      getMockStore().lead_enrichment.find((e) => e.cnpj === cnpj) ?? null
    );
  },

  async upsertEnrichment(row: LeadEnrichment) {
    const store = getMockStore();
    store.lead_enrichment = store.lead_enrichment.filter((e) => e.cnpj !== row.cnpj);
    store.lead_enrichment.push(row);
  },

  async updateJob(id, patch) {
    const job = getMockStore().enrichment_jobs.find((j) => j.id === id);
    if (!job) return;
    Object.assign(job, patch);
  },

  async claimEnrichmentJob() {
    const store = getMockStore();
    const stale = Date.now() - 10 * 60 * 1000;
    const job = store.enrichment_jobs
      .filter(
        (j) =>
          j.status === "pending" ||
          (j.status === "running" &&
            j.locked_at &&
            new Date(j.locked_at).getTime() < stale),
      )
      .sort(compareEnrichmentClaimOrder)[0];
    if (!job) return null;
    job.status = "running";
    job.locked_at = new Date().toISOString();
    job.attempts += 1;
    return job;
  },

  async findFreshEnrichment(cnpj: string) {
    const row = getMockStore().lead_enrichment.find((e) => e.cnpj === cnpj);
    return isEnrichmentFresh(row) ? row! : null;
  },

  async hasActiveEnrichmentJob(cnpj: string) {
    return getMockStore().enrichment_jobs.some(
      (j) =>
        j.cnpj === cnpj && (j.status === "pending" || j.status === "running"),
    );
  },

  async classifyEnrichmentCnpjs(cnpjs: string[], userId?: string) {
    const unique = [...new Set(cnpjs)];
    let skippedOptOut = 0;
    const chargeable: string[] = [];
    for (const cnpj of unique) {
      if (await this.isOptedOut(cnpj)) {
        skippedOptOut += 1;
        continue;
      }
      if (userId) {
        const store = getMockStore();
        const billedOnly =
          store.billed_cnpjs.some(
            (row) =>
              row.profile_id === userId &&
              row.kind === "enrich" &&
              digitsCnpj(row.cnpj) === digitsCnpj(cnpj),
          ) ||
          listMemoryBilledCnpjs(userId, "enrich").some(
            (c) => digitsCnpj(c) === digitsCnpj(cnpj),
          );
        if (billedOnly) continue;
        const activeMine = store.enrichment_jobs.some(
          (j) =>
            digitsCnpj(j.cnpj) === digitsCnpj(cnpj) &&
            j.requested_by === userId &&
            (j.status === "pending" || j.status === "running"),
        );
        if (activeMine) continue;
        chargeable.push(cnpj);
        continue;
      }
      if (await this.findFreshEnrichment(cnpj)) continue;
      if (await this.hasActiveEnrichmentJob(cnpj)) continue;
      chargeable.push(cnpj);
    }
    return { chargeable, skippedOptOut };
  },

  async getLatestEnrichmentJob(cnpj: string) {
    const jobs = getMockStore()
      .enrichment_jobs.filter((j) => j.cnpj === cnpj)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return jobs[0] ?? null;
  },

  async getDomainCache(cnpjBasico: string) {
    const row = getMockStore().domain_cache.find((d) => d.cnpj_basico === cnpjBasico);
    return row ? { domain: row.domain, status: row.status } : null;
  },

  async setDomainCache(cnpjBasico, domain, status) {
    const store = getMockStore();
    store.domain_cache = store.domain_cache.filter((d) => d.cnpj_basico !== cnpjBasico);
    store.domain_cache.push({
      cnpj_basico: cnpjBasico,
      domain,
      status,
      resolved_at: new Date().toISOString(),
    });
  },

  async listIntegrationConnections(userId) {
    return getMockStore().integration_connections.filter((c) => c.user_id === userId);
  },

  async getIntegrationConnection(id) {
    return getMockStore().integration_connections.find((c) => c.id === id) ?? null;
  },

  async createIntegrationConnection(row) {
    getMockStore().integration_connections.push(row);
    return row;
  },

  async updateIntegrationConnection(id, userId, patch) {
    const row = getMockStore().integration_connections.find(
      (c) => c.id === id && c.user_id === userId,
    );
    if (!row) return null;
    Object.assign(row, patch, { updated_at: new Date().toISOString() });
    return row;
  },

  async deleteIntegrationConnection(id, userId) {
    const store = getMockStore();
    const before = store.integration_connections.length;
    store.integration_connections = store.integration_connections.filter(
      (c) => !(c.id === id && c.user_id === userId),
    );
    return store.integration_connections.length < before;
  },

  async createIntegrationJob(row) {
    const store = getMockStore();
    const id =
      (store.integration_jobs.reduce((m, j) => Math.max(m, j.id), 0) || 0) + 1;
    const job = {
      ...row,
      id,
      status: row.status ?? "pending",
      attempts: 0,
      last_error: null,
      result: null,
      locked_at: null,
      created_at: new Date().toISOString(),
      finished_at: null,
    };
    store.integration_jobs.push(job);
    return job;
  },

  async listIntegrationJobs(userId, searchId) {
    return getMockStore()
      .integration_jobs.filter((j) => j.user_id === userId)
      .filter((j) => (searchId ? j.search_id === searchId : true))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async claimIntegrationJob() {
    const store = getMockStore();
    const stale = Date.now() - 10 * 60 * 1000;
    const job = store.integration_jobs.find(
      (j) =>
        j.status === "pending" ||
        (j.status === "running" &&
          j.locked_at &&
          new Date(j.locked_at).getTime() < stale),
    );
    if (!job) return null;
    job.status = "running";
    job.locked_at = new Date().toISOString();
    job.attempts += 1;
    return job;
  },

  async updateIntegrationJob(id, patch) {
    const job = getMockStore().integration_jobs.find((j) => j.id === id);
    if (!job) return;
    Object.assign(job, patch);
  },

  async insertIntegrationEvent(row) {
    getMockStore().integration_events.push({
      ...row,
      id: randomId(),
      created_at: new Date().toISOString(),
    });
  },

  async findSavedLeadForOutcome(userId, input) {
    const store = getMockStore();
    const leads = store.saved_leads.filter((l) => l.user_id === userId);
    if (input.searchId) {
      const hit = leads.find(
        (l) =>
          l.search_id === input.searchId &&
          (!input.cnpj || l.cnpj === input.cnpj),
      );
      if (hit) {
        return { id: hit.id, cnpj: hit.cnpj, search_id: hit.search_id };
      }
    }
    if (input.cnpj) {
      const hit = [...leads]
        .reverse()
        .find((l) => l.cnpj === input.cnpj);
      if (hit) {
        return { id: hit.id, cnpj: hit.cnpj, search_id: hit.search_id };
      }
    }
    if (input.e164) {
      const est = store.establishments.find((e) => {
        const a = e.ddd1 && e.telefone1 ? `+55${e.ddd1}${e.telefone1}` : "";
        const b = e.ddd2 && e.telefone2 ? `+55${e.ddd2}${e.telefone2}` : "";
        return a === input.e164 || b === input.e164;
      });
      if (!est) return null;
      const hit = [...leads].reverse().find((l) => l.cnpj === est.cnpj);
      if (hit) {
        return { id: hit.id, cnpj: hit.cnpj, search_id: hit.search_id };
      }
    }
    return null;
  },

  ...crmMockMethods,
  ...catchupMockMethods,
};
