import {
  hasAccountantDomainHint,
  isFreeEmail,
  phoneSealFromUsage,
  sealRank,
} from "@/lib/contact-confidence";
import { pickDecisor, qualificacaoLabel, toPartnerCards } from "@/lib/decisor";
import { yearsSince } from "@/lib/format";
import { buildGoldenMinute } from "@/lib/golden-minute";
import { isEnrichmentComplete, isEnrichmentVisible } from "@/lib/enrichment/fresh";
import { midiaPagaLabel } from "@/lib/enrichment/tech";
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
import { cnaeMatchesQuery, presetMatchesQuery, queryTokens } from "@/lib/segment-aliases";
import { computeDorDigital, computeGridScore } from "@/lib/scoring";
import {
  canSearchCompanies,
  COMPANY_NAME_SEARCH_TIMEOUT_MS,
  COMPANY_PREFIX_ENOUGH,
  COMPANY_SEARCH_LIMIT,
  companyIlikeTokens,
  companyNameTokens,
  escapeIlike,
  isCompanyCnpjQuery,
  mergeCompanyNameWaves,
  sqlFoldAccent,
} from "@/lib/data/company-search";
import {
  cachedCandidateCnpjs,
  countCacheKey,
  getCountCache,
  setCountCache,
} from "@/lib/cache/count-cache";
import {
  withCountSingleFlight,
  withCountSlot,
} from "@/lib/cache/count-slots";
import {
  SEARCH_JOB_DONE_REUSE_MINUTES,
  SEARCH_JOB_LIVE_REUSE_MINUTES,
  SEARCH_JOB_STALE_RUNNING_SECONDS,
  type SearchJob,
  type SearchJobStatus,
} from "@/lib/search-jobs";
import {
  CNAE_ANY_SQL,
  FLAT_COUNT_CAP,
  FLAT_COUNT_PREVIEW_CAP,
  SEARCH_CANDIDATE_CAP,
  UF_ANY_SQL,
  cnaeChar7Params,
  flatCountSql,
  flatEstablishmentsByCnpjsSql,
  flatRankedEstablishmentsSql,
  ufChar2Params,
} from "@/lib/data/establishments-search-sql";
import { municipioListLimit } from "@/lib/municipios";
import {
  LOCAL_USER_ID,
  allQueries,
  isMissingOrUnpopulatedRelationError,
  isStatementTimeoutError,
  isUndefinedTableError,
  pgErrorCode,
  query,
  querySearch,
  querySearchWithTimeout,
} from "@/lib/data/pg";
import { contactsFromEnrichmentPhones, overlayGridPhone } from "@/lib/grid-phone";
import {
  gridRowFromSnapshot,
  gridRowStub,
  parseGridSnapshot,
} from "@/lib/grid-snapshot";
import { callStreak, saoPauloDay } from "@/lib/call-stats";
import {
  DEFAULT_CALL_GOAL,
  DEFAULT_MEETING_MINUTES,
  isTratamento,
} from "@/lib/pilot-profile";
import { crmPgMethods } from "@/lib/data/crm-pg";
import { catchupPgMethods } from "@/lib/data/catchup-pg";
import type { GridRepo } from "@/lib/data/repo";
import { unsavedIdsToPrune } from "@/lib/searches";
import type {
  IntegrationConnectionRecord,
  IntegrationJobRecord,
} from "@/lib/integrations/records";
import type { IntegrationKind, IntegrationProvider } from "@/lib/integrations/schema";
import type {
  Company,
  CompanyBrief,
  CompanySearchHit,
  ContactInfo,
  CountMode,
  CountResult,
  DomainStatus,
  EnrichmentJob,
  EnrichmentJobStatus,
  Establishment,
  GridRow,
  GridRowSnapshot,
  LeadDossier,
  LeadEnrichment,
  LeadStatus,
  NextCallLead,
  NichePreset,
  NichePresetCnae,
  Partner,
  Profile,
  RefCnae,
  RefMunicipio,
  RefQualificacao,
  ScoreProfile,
  Search,
  SearchFilters,
  SharedPhoneVerdict,
} from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/types";
import { displayCompanyName } from "@/lib/enrichment/company-name";
import { matchPresetForCnae } from "@/lib/crm/pipeline-from-cnae";

const COUNT_CAP = FLAT_COUNT_CAP;
const RESULT_CAP = 1000;
const CANDIDATE_CAP = SEARCH_CANDIDATE_CAP;

const CAPITALS: Record<string, string> = {
  AC: "Rio Branco",
  AL: "Maceió",
  AP: "Macapá",
  AM: "Manaus",
  BA: "Salvador",
  CE: "Fortaleza",
  DF: "Brasília",
  ES: "Vitória",
  GO: "Goiânia",
  MA: "São Luís",
  MT: "Cuiabá",
  MS: "Campo Grande",
  MG: "Belo Horizonte",
  PA: "Belém",
  PB: "João Pessoa",
  PR: "Curitiba",
  PE: "Recife",
  PI: "Teresina",
  RJ: "Rio de Janeiro",
  RN: "Natal",
  RS: "Porto Alegre",
  RO: "Porto Velho",
  RR: "Boa Vista",
  SC: "Florianópolis",
  SP: "São Paulo",
  SE: "Aracaju",
  TO: "Palmas",
};

function freeEmailSql(alias: string): string {
  const needles = [
    "gmail",
    "hotmail",
    "outlook",
    "yahoo",
    "uol",
    "bol",
    "terra",
    "ig.com",
    "live.com",
    "uai.com",
    "globo.com",
    "zipmail",
    "icloud",
    "proton",
    "aol.com",
    "msn.com",
    "r7.com",
    "oi.com.br",
    "pop.com.br",
  ];
  return needles
    .map(
      (n) =>
        `lower(split_part(${alias}.email, '@', 2)) like ${sqlLiteral("%" + n + "%")}`,
    )
    .join(" or ");
}

const FREE_EMAIL_SQL = freeEmailSql("e");

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function trimChar(value: unknown): string {
  return String(value ?? "").trim();
}

function dateStr(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function isoStr(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return value;
  return new Date().toISOString();
}

function digitsCnpj(value: string): string {
  return value.replace(/\D/g, "").padStart(14, "0");
}

function cnpjChar14Params(cnpjs: string[]): string[] {
  return [...new Set(cnpjs.map(digitsCnpj))];
}

function mapCompany(r: Record<string, unknown>): Company {
  return {
    cnpj_basico: trimChar(r.cnpj_basico),
    razao_social: String(r.razao_social ?? ""),
    natureza_id: r.natureza_id == null ? null : Number(r.natureza_id),
    qualificacao_responsavel:
      r.qualificacao_responsavel == null
        ? null
        : Number(r.qualificacao_responsavel),
    capital_social: r.capital_social == null ? null : Number(r.capital_social),
    porte:
      r.porte == null && r.company_porte == null
        ? null
        : trimChar(r.porte ?? r.company_porte),
  };
}

function mapEstablishment(r: Record<string, unknown>): Establishment {
  return {
    cnpj: trimChar(r.cnpj),
    cnpj_basico: trimChar(r.cnpj_basico),
    is_matriz: Boolean(r.is_matriz),
    nome_fantasia: r.nome_fantasia == null ? null : String(r.nome_fantasia),
    situacao: trimChar(r.situacao),
    data_situacao: dateStr(r.data_situacao),
    data_inicio: dateStr(r.data_inicio),
    cnae_principal: trimChar(r.cnae_principal),
    cnae_secundarios: Array.isArray(r.cnae_secundarios)
      ? (r.cnae_secundarios as string[])
      : [],
    logradouro: r.logradouro == null ? null : String(r.logradouro),
    numero: r.numero == null ? null : String(r.numero),
    complemento: r.complemento == null ? null : String(r.complemento),
    bairro: r.bairro == null ? null : String(r.bairro),
    cep: r.cep == null ? null : trimChar(r.cep),
    uf: trimChar(r.uf),
    municipio_id: Number(r.municipio_id),
    ddd1: r.ddd1 == null ? null : String(r.ddd1),
    telefone1: r.telefone1 == null ? null : String(r.telefone1),
    ddd2: r.ddd2 == null ? null : String(r.ddd2),
    telefone2: r.telefone2 == null ? null : String(r.telefone2),
    email: r.email == null ? null : String(r.email),
  };
}

function mapPartner(r: Record<string, unknown>): Partner {
  return {
    id: Number(r.id),
    cnpj_basico: trimChar(r.cnpj_basico),
    nome: String(r.nome ?? ""),
    qualificacao_id: Number(r.qualificacao_id),
    data_entrada: dateStr(r.data_entrada),
    faixa_etaria: r.faixa_etaria == null ? null : Number(r.faixa_etaria),
  };
}

function mapPreset(r: Record<string, unknown>): NichePreset {
  return {
    id: String(r.id),
    slug: String(r.slug),
    nome: String(r.nome),
    grupo: r.grupo === "b2b_industria" ? "b2b_industria" : "b2c_local",
    perfil_score:
      r.perfil_score === "b2b_industria" ? "b2b_industria" : "b2c_local",
    parent_id: r.parent_id == null ? null : String(r.parent_id),
    keywords: (r.keywords as string[]) ?? [],
    exclusoes: (r.exclusoes as string[]) ?? [],
    name_stems: (r.name_stems as string[]) ?? [],
    aliases: (r.aliases as string[]) ?? [],
    curado: Boolean(r.curado),
    ordem: Number(r.ordem ?? 0),
  };
}

function mapProfile(r: Record<string, unknown>): Profile {
  const tipo = r.documento_tipo === "cnpj" || r.documento_tipo === "cpf"
    ? r.documento_tipo
    : null;
  return {
    id: String(r.id),
    nome: r.nome == null ? null : String(r.nome),
    plano: String(r.plano ?? "free"),
    creditos: Number(r.creditos ?? 0),
    especialidade: r.especialidade == null ? null : String(r.especialidade),
    area: r.area == null ? null : String(r.area),
    empresa_usuario: r.empresa_usuario == null ? null : String(r.empresa_usuario),
    cidade_usuario: r.cidade_usuario == null ? null : String(r.cidade_usuario),
    documento: r.documento == null ? null : String(r.documento),
    documento_tipo: tipo,
    foto_url: r.foto_url == null ? null : String(r.foto_url),
    como_chama: r.como_chama == null ? null : String(r.como_chama),
    tratamento: isTratamento(r.tratamento) ? r.tratamento : null,
    promessa: r.promessa == null ? null : String(r.promessa),
    duracao_reuniao: Number(r.duracao_reuniao ?? DEFAULT_MEETING_MINUTES),
    meta_ligacoes_dia: Number(r.meta_ligacoes_dia ?? DEFAULT_CALL_GOAL),
    onboarding_completed_at:
      r.onboarding_completed_at == null ? null : isoStr(r.onboarding_completed_at),
    created_at: isoStr(r.created_at),
  };
}

function mapSearch(r: Record<string, unknown>): Search {
  const raw = (r.filtros ?? {}) as Partial<SearchFilters>;
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    nome: String(r.nome),
    filtros: {
      ...DEFAULT_FILTERS,
      ...raw,
      cnaes: raw.cnaes ?? [],
      segmentIds: raw.segmentIds ?? [],
      cnpjs: raw.cnpjs ?? [],
      ufs: raw.ufs ?? [],
      municipioIds: raw.municipioIds ?? [],
      portes: raw.portes ?? [],
    },
    total_found: Number(r.total_found ?? 0),
    created_at: isoStr(r.created_at),
    saved: Boolean(r.saved),
  };
}

function mapSearchJob(r: Record<string, unknown>): SearchJob {
  const raw = (r.filtros ?? {}) as Partial<SearchFilters>;
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    nome: String(r.nome),
    filtros: {
      ...DEFAULT_FILTERS,
      ...raw,
      cnaes: raw.cnaes ?? [],
      segmentIds: raw.segmentIds ?? [],
      cnpjs: raw.cnpjs ?? [],
      ufs: raw.ufs ?? [],
      municipioIds: raw.municipioIds ?? [],
      portes: raw.portes ?? [],
    },
    status: String(r.status) as SearchJobStatus,
    search_id: r.search_id ? String(r.search_id) : null,
    error: r.error == null ? null : String(r.error),
    attempts: Number(r.attempts ?? 0),
    locked_at: r.locked_at ? isoStr(r.locked_at) : null,
    created_at: isoStr(r.created_at),
    finished_at: r.finished_at ? isoStr(r.finished_at) : null,
  };
}

function mapJob(r: Record<string, unknown>): EnrichmentJob {
  return {
    id: Number(r.id),
    cnpj: trimChar(r.cnpj),
    requested_by: r.requested_by == null ? null : String(r.requested_by),
    search_id: r.search_id == null ? null : String(r.search_id),
    status: String(r.status) as EnrichmentJobStatus,
    attempts: Number(r.attempts ?? 0),
    last_error: r.last_error == null ? null : String(r.last_error),
    locked_at: r.locked_at == null ? null : isoStr(r.locked_at),
    created_at: isoStr(r.created_at),
    finished_at: r.finished_at == null ? null : isoStr(r.finished_at),
    payload: (r.payload ?? null) as EnrichmentJob["payload"],
    priority: Number(r.priority ?? 0),
  };
}

function mapEnrichment(r: Record<string, unknown>): LeadEnrichment {
  const tech = (r.tech ?? {}) as LeadEnrichment["tech"];
  return {
    cnpj: trimChar(r.cnpj),
    domain: r.domain == null ? null : String(r.domain),
    domain_status: (r.domain_status as DomainStatus) ?? "nao_encontrado",
    http_status: r.http_status == null ? null : Number(r.http_status),
    phones: Array.isArray(r.phones) ? (r.phones as LeadEnrichment["phones"]) : [],
    emails: Array.isArray(r.emails) ? (r.emails as LeadEnrichment["emails"]) : [],
    whatsapp: r.whatsapp == null ? null : String(r.whatsapp),
    socials: (r.socials ?? {}) as LeadEnrichment["socials"],
    tech: {
      metaPixel: Boolean(tech.metaPixel),
      gtm: Boolean(tech.gtm),
      ga4: Boolean(tech.ga4),
      googleAds: Boolean(tech.googleAds),
      tiktokPixel: Boolean(tech.tiktokPixel),
      rdStation: Boolean(tech.rdStation),
      hotjar: Boolean(tech.hotjar),
      clarity: Boolean(tech.clarity),
      chat: tech.chat ?? null,
      plataforma: tech.plataforma ?? null,
      https: Boolean(tech.https),
      viewport: Boolean(tech.viewport),
    },
    freshness: (r.freshness ?? {}) as LeadEnrichment["freshness"],
    osm: (r.osm ?? null) as LeadEnrichment["osm"],
    gmb: (r.gmb ?? null) as LeadEnrichment["gmb"],
    discarded_domains: Array.isArray(r.discarded_domains)
      ? (r.discarded_domains as string[])
      : [],
    dor_digital: Number(r.dor_digital ?? 0),
    contexto: Array.isArray(r.contexto) ? (r.contexto as string[]) : [],
    fonte: (r.fonte ?? {}) as LeadEnrichment["fonte"],
    midiaPaga: midiaPagaLabel(
      {
        metaPixel: Boolean(tech.metaPixel),
        gtm: Boolean(tech.gtm),
        ga4: Boolean(tech.ga4),
        googleAds: Boolean(tech.googleAds),
        tiktokPixel: Boolean(tech.tiktokPixel),
        rdStation: Boolean(tech.rdStation),
        hotjar: Boolean(tech.hotjar),
        clarity: Boolean(tech.clarity),
        chat: tech.chat ?? null,
        plataforma: tech.plataforma ?? null,
        https: Boolean(tech.https),
        viewport: Boolean(tech.viewport),
      },
      ((r.domain_status as DomainStatus) ?? "nao_encontrado") === "confirmado",
    ),
    people: Array.isArray(r.people)
      ? (r.people as LeadEnrichment["people"])
      : r.people == null
        ? null
        : undefined,
    stage: isEnrichmentStage(r.stage) ? r.stage : "complete",
    collected_at: isoStr(r.collected_at),
    expires_at: isoStr(r.expires_at),
  };
}

function isEnrichmentStage(value: unknown): value is LeadEnrichment["stage"] {
  return (
    value === "domain" ||
    value === "home" ||
    value === "presence" ||
    value === "site" ||
    value === "complete"
  );
}

function isEnrichmentFresh(row: LeadEnrichment | null | undefined): boolean {
  return isEnrichmentComplete(row);
}

type FilterSql = { sql: string; params: unknown[] };

function needsCompaniesJoin(filters: SearchFilters): boolean {
  return (
    filters.portes.length > 0 ||
    filters.capitalMin != null ||
    filters.capitalMax != null
  );
}

function buildMatchFrom(filters: SearchFilters): string {
  const parts = ["from establishments e"];
  if (needsCompaniesJoin(filters)) {
    parts.push("join companies c on c.cnpj_basico = e.cnpj_basico");
  }
  if (filters.excluirSimples) {
    parts.push("left join simples_nacional s on s.cnpj_basico = e.cnpj_basico");
  }
  if (filters.ocultarTelefonesCompartilhados) {
    parts.push(
      "left join phone_shared_verdict pv on pv.ddd1 = e.ddd1 and pv.telefone1 = e.telefone1",
    );
  }
  if (filters.ocultarEnderecosCompartilhados) {
    parts.push(
      "left join address_usage au on au.cep = e.cep and au.logradouro = e.logradouro and au.numero = e.numero",
    );
  }
  if (filters.soEnriquecidas) {
    parts.push(
      "left join lead_enrichment le on le.cnpj = e.cnpj and le.expires_at > now() and (le.stage is null or le.stage = 'complete')",
    );
  }
  return parts.join("\n  ");
}

function buildStructuralFilterSql(
  filters: SearchFilters,
  allowedCnaes: Set<string> | null,
): FilterSql {
  const params: unknown[] = [];
  const clauses: string[] = ["1=1"];
  const add = (fragment: string, value: unknown) => {
    params.push(value);
    clauses.push(fragment.replace("?", `$${params.length}`));
  };

  if (filters.cnpjs?.length) {
    add(
      "e.cnpj = any(?::char(14)[])",
      filters.cnpjs.map((c) => c.replace(/\D/g, "").padStart(14, "0")),
    );
  }
  if (allowedCnaes) {
    if (allowedCnaes.has("__none__") || allowedCnaes.size === 0) {
      clauses.push("false");
    } else {
      add(`e.cnae_principal = ${CNAE_ANY_SQL}`, cnaeChar7Params([...allowedCnaes]));
    }
  }
  if (filters.ufs.length) add(`e.uf = ${UF_ANY_SQL}`, ufChar2Params(filters.ufs));
  if (filters.municipioIds.length) {
    add("e.municipio_id = any(?::int[])", filters.municipioIds);
  }
  clauses.push(`not exists (
    select 1 from opt_outs o
    where o.documento in (e.cnpj, e.cnpj_basico)
  )`);

  return { sql: clauses.join("\n    and "), params };
}

type MunicipioCountRow = {
  municipio_id: number;
  nome: string;
  uf: string;
  total: number;
};

function mapMunicipioCountRows(
  rows: MunicipioCountRow[] | null | undefined,
): CountResult["porMunicipio"] {
  if (!Array.isArray(rows)) return [];
  return rows.map((m) => ({
    municipio_id: Number(m.municipio_id),
    nome: m.nome,
    uf: trimChar(m.uf),
    total: Number(m.total),
  }));
}

async function fetchTopMunicipiosPreview(
  filters: SearchFilters,
  allowed: Set<string> | null,
): Promise<CountResult["porMunicipio"]> {
  const { sql, params } = buildStructuralFilterSql(filters, allowed);
  const limitParam = params.length + 1;
  const { rows } = await querySearch<{ por_municipio: MunicipioCountRow[] | null }>(
    `with matched as (
       select e.municipio_id
       from establishments e
       where ${sql}
       limit $${limitParam}
     ),
     top_mun as (
       select m.municipio_id,
              coalesce(r.nome, 'NÃO ENCONTRADO') as nome,
              coalesce(r.uf, '') as uf,
              count(*)::int as total
       from matched m
       left join ref_municipio r on r.id = m.municipio_id
       group by 1, 2, 3
       order by total desc
       limit 5
     )
     select coalesce(
       (select json_agg(json_build_object(
         'municipio_id', t.municipio_id,
         'nome', t.nome,
         'uf', t.uf,
         'total', t.total
       ) order by t.total desc) from top_mun t),
       '[]'::json
     ) as por_municipio`,
    [...params, COUNT_CAP],
  );
  const munRows = rows[0]?.por_municipio;
  return mapMunicipioCountRows(Array.isArray(munRows) ? munRows : []);
}

async function countTotalPreviewLegacy(
  filters: SearchFilters,
  allowed: Set<string> | null,
): Promise<CountResult> {
  let total = 0;
  let capped = false;
  let usedMv = false;

  if (canFastCountPreview(filters, allowed) && (await hasCnaeUfCount())) {
    try {
      const params: unknown[] = [cnaeChar7Params([...allowed!])];
      let ufSql = "";
      if (filters.ufs.length) {
        params.push(ufChar2Params(filters.ufs));
        ufSql = ` and uf = any($${params.length}::char(2)[])`;
      }
      const { rows } = await querySearch<{ n: number }>(
        `select coalesce(sum(n), 0)::int as n
         from cnae_uf_count
         where cnae_principal = any($1::char(7)[])${ufSql}`,
        params,
      );
      const raw = Number(rows[0]?.n ?? 0);
      capped = raw > COUNT_CAP;
      total = capped ? COUNT_CAP : raw;
      usedMv = true;
    } catch (err) {
      if (
        !isMissingOrUnpopulatedRelationError(err) &&
        !isStatementTimeoutError(err)
      ) {
        throw err;
      }
    }
  }

  if (!usedMv) {
    const { sql, params } = buildStructuralFilterSql(filters, allowed);
    const limitParam = params.length + 1;
    const { rows } = await querySearch<{ n: number }>(
      `with matched as (
         select 1
         from establishments e
         where ${sql}
         limit $${limitParam}
       )
       select count(*)::int as n from matched`,
      [...params, COUNT_CAP + 1],
    );
    const raw = Number(rows[0]?.n ?? 0);
    capped = raw > COUNT_CAP;
    total = capped ? COUNT_CAP : raw;
  }

  const porMunicipio =
    filters.ufs.length > 0 || filters.municipioIds.length > 0
      ? await fetchTopMunicipiosPreview(filters, allowed).catch(() => [])
      : [];

  return {
    total,
    capped,
    comTelefone: 0,
    comEmail: 0,
    comDecisor: 0,
    porMunicipio,
  };
}

function buildFilterSql(filters: SearchFilters, allowedCnaes: Set<string> | null): FilterSql {
  const structural = buildStructuralFilterSql(filters, allowedCnaes);
  const params = [...structural.params];
  const clauses = structural.sql.split("\n    and ");

  const add = (fragment: string, value: unknown) => {
    params.push(value);
    clauses.push(fragment.replace("?", `$${params.length}`));
  };

  if (filters.soMatriz) clauses.push("e.is_matriz = true");
  if (filters.portes.length) add("c.porte = any(?::text[])", filters.portes);
  if (filters.capitalMin != null) {
    add("coalesce(c.capital_social, 0) >= ?", filters.capitalMin);
  }
  if (filters.capitalMax != null) {
    add("coalesce(c.capital_social, 0) <= ?", filters.capitalMax);
  }
  if (filters.idadeMinimaAnos > 0) {
    add(
      "e.data_inicio is not null and e.data_inicio <= (current_date - make_interval(years => ?::int))",
      filters.idadeMinimaAnos,
    );
  }
  if (filters.excluirSimples) {
    clauses.push("coalesce(s.opcao_simples, false) = false");
  }
  if (filters.ocultarTelefonesCompartilhados) {
    clauses.push("coalesce(pv.verdict, 'proprio') is distinct from 'contabilidade'");
  }
  if (filters.soEnriquecidas) {
    clauses.push("le.cnpj is not null");
  }
  if (filters.ocultarEmailsGratuitos) {
    clauses.push(`(e.email is null or not (${FREE_EMAIL_SQL}))`);
  }
  if (filters.ocultarEnderecosCompartilhados) {
    clauses.push("coalesce(au.qtd_empresas, 0) < 5");
  }
  if (filters.exigirEmailProprio) {
    clauses.push(
      `e.email is not null and e.email like '%@%' and not (${FREE_EMAIL_SQL}) and lower(split_part(e.email, '@', 2)) not similar to '%(contab|contabil|assessoria|escritorio|fiscal|tributar)%'`,
    );
  }
  if (filters.exigirDecisor) {
    clauses.push(
      "exists (select 1 from partners p where p.cnpj_basico = e.cnpj_basico)",
    );
  }

  return { sql: clauses.join("\n    and "), params };
}

function buildFlatMatchFrom(filters: SearchFilters): string {
  if (!filters.soEnriquecidas) return "";
  return `left join lead_enrichment le on le.cnpj = es.cnpj
    and le.expires_at > now()
    and (le.stage is null or le.stage = 'complete')`;
}

function buildFlatStructuralFilterSql(
  filters: SearchFilters,
  allowedCnaes: Set<string> | null,
): FilterSql {
  const params: unknown[] = [];
  const clauses: string[] = ["es.opted_out = false"];
  const add = (fragment: string, value: unknown) => {
    params.push(value);
    clauses.push(fragment.replace("?", `$${params.length}`));
  };

  if (filters.cnpjs?.length) {
    add(
      "es.cnpj = any(?::char(14)[])",
      filters.cnpjs.map((c) => c.replace(/\D/g, "").padStart(14, "0")),
    );
  }
  if (allowedCnaes) {
    if (allowedCnaes.has("__none__") || allowedCnaes.size === 0) {
      clauses.push("false");
    } else {
      add(`es.cnae_principal = ${CNAE_ANY_SQL}`, cnaeChar7Params([...allowedCnaes]));
    }
  }
  if (filters.ufs.length) add(`es.uf = ${UF_ANY_SQL}`, ufChar2Params(filters.ufs));
  if (filters.municipioIds.length) {
    add("es.municipio_id = any(?::int[])", filters.municipioIds);
  }

  return { sql: clauses.join("\n    and "), params };
}

function buildFlatFilterSql(
  filters: SearchFilters,
  allowedCnaes: Set<string> | null,
): FilterSql {
  const structural = buildFlatStructuralFilterSql(filters, allowedCnaes);
  const params = [...structural.params];
  const clauses = structural.sql.split("\n    and ");

  const add = (fragment: string, value: unknown) => {
    params.push(value);
    clauses.push(fragment.replace("?", `$${params.length}`));
  };

  if (filters.soMatriz) clauses.push("es.is_matriz = true");
  if (filters.portes.length) add("es.porte = any(?::text[])", filters.portes);
  if (filters.capitalMin != null) {
    add("coalesce(es.capital_social, 0) >= ?", filters.capitalMin);
  }
  if (filters.capitalMax != null) {
    add("coalesce(es.capital_social, 0) <= ?", filters.capitalMax);
  }
  if (filters.idadeMinimaAnos > 0) {
    add(
      "es.data_inicio is not null and es.data_inicio <= (current_date - make_interval(years => ?::int))",
      filters.idadeMinimaAnos,
    );
  }
  if (filters.excluirSimples) clauses.push("es.opcao_simples = false");
  if (filters.ocultarTelefonesCompartilhados) {
    clauses.push("es.phone_verdict is distinct from 'contabilidade'");
  }
  if (filters.soEnriquecidas) clauses.push("le.cnpj is not null");
  if (filters.ocultarEmailsGratuitos) {
    clauses.push("(es.email is null or not es.email_livre)");
  }
  if (filters.ocultarEnderecosCompartilhados) {
    clauses.push("es.endereco_compartilhado = false");
  }
  if (filters.exigirEmailProprio) clauses.push("es.email_proprio = true");
  if (filters.exigirDecisor) clauses.push("es.tem_decisor = true");

  return { sql: clauses.join("\n    and "), params };
}

async function countViaFlatTable(
  filters: SearchFilters,
  allowed: Set<string> | null,
  opts: { includeStats: boolean; cap: number },
): Promise<CountResult> {
  const { sql, params } = buildFlatFilterSql(filters, allowed);
  const joinSql = buildFlatMatchFrom(filters);
  const limitParam = params.length + 1;
  const includeCnpjs = opts.includeStats;
  const { rows } = await querySearch<{
    total_probe: number;
    com_telefone: number;
    com_email: number;
    com_decisor: number;
    por_municipio: MunicipioCountRow[] | null;
    cnpjs: unknown;
  }>(
    flatCountSql(sql, joinSql, limitParam, {
      includeStats: opts.includeStats,
      cap: opts.cap,
      includeCnpjs,
    }),
    [...params, opts.cap + 1],
  );
  const row = rows[0];
  const raw = Number(row?.total_probe ?? 0);
  const capped = raw > opts.cap;
  const munRows = Array.isArray(row?.por_municipio) ? row.por_municipio : [];
  const result: CountResult = {
    total: capped ? opts.cap : raw,
    capped,
    comTelefone: Number(row?.com_telefone ?? 0),
    comEmail: Number(row?.com_email ?? 0),
    comDecisor: Number(row?.com_decisor ?? 0),
    porMunicipio: mapMunicipioCountRows(munRows),
  };
  if (includeCnpjs && !capped) {
    const cnpjs = parseCountCnpjs(row?.cnpjs, CANDIDATE_CAP);
    if (cnpjs) result.cnpjs = cnpjs;
  }
  return result;
}

function parseCountCnpjs(raw: unknown, cap: number): string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > cap) return undefined;
  const list = [
    ...new Set(
      raw
        .map((value) => String(value ?? "").replace(/\D/g, "").padStart(14, "0"))
        .filter((cnpj) => cnpj.length === 14),
    ),
  ];
  if (!list.length || list.length > cap) return undefined;
  return list;
}

function canFastCountStructural(
  filters: SearchFilters,
  allowed: Set<string> | null,
): boolean {
  if (!allowed || allowed.has("__none__") || allowed.size === 0) return false;
  if (filters.cnpjs?.length) return false;
  if (filters.municipioIds.length) return false;
  if (filters.portes.length) return false;
  if (filters.capitalMin != null || filters.capitalMax != null) return false;
  if (filters.idadeMinimaAnos > 0) return false;
  return true;
}

function canFastCount(filters: SearchFilters, allowed: Set<string> | null): boolean {
  if (!canFastCountStructural(filters, allowed)) return false;
  if (filters.soMatriz) return false;
  if (filters.excluirSimples) return false;
  if (filters.exigirEmailProprio || filters.exigirDecisor) return false;
  if (filters.ocultarEmailsGratuitos || filters.ocultarEnderecosCompartilhados) {
    return false;
  }
  if (filters.soEnriquecidas) return false;
  if (filters.ocultarTelefonesCompartilhados) return false;
  return true;
}

function canFastCountPreview(filters: SearchFilters, allowed: Set<string> | null): boolean {
  return canFastCountStructural(filters, allowed);
}

const REF_CACHE_TTL_MS = 5 * 60 * 1000;

type Timed<T> = { value: T; expiresAt: number };

type GridRefCache = {
  refCnaes?: Timed<RefCnae[]>;
  refMunicipios?: Timed<RefMunicipio[]>;
  quals?: Timed<RefQualificacao[]>;
  presets?: Timed<NichePreset[]>;
  presetCnaes?: Timed<NichePresetCnae[]>;
  cnaeUfCount?: Timed<boolean>;
  establishmentsSearch?: Timed<boolean>;
};

const globalForCache = globalThis as typeof globalThis & {
  __gridRefCache?: GridRefCache;
};

function refCache(): GridRefCache {
  if (!globalForCache.__gridRefCache) globalForCache.__gridRefCache = {};
  return globalForCache.__gridRefCache;
}

function cacheGet<T>(entry: Timed<T> | undefined): T | undefined {
  if (!entry || entry.expiresAt <= Date.now()) return undefined;
  return entry.value;
}

function cacheSet<T>(value: T): Timed<T> {
  return { value, expiresAt: Date.now() + REF_CACHE_TTL_MS };
}

function invalidatePresetCache() {
  const cache = refCache();
  delete cache.presets;
  delete cache.presetCnaes;
}

async function loadRefCnaes(): Promise<RefCnae[]> {
  const hit = cacheGet(refCache().refCnaes);
  if (hit) return hit;
  const { rows } = await query<{ codigo: string; descricao: string }>(
    "select codigo, descricao from ref_cnae",
  );
  const value = rows.map((r) => ({
    codigo: trimChar(r.codigo),
    descricao: r.descricao,
  }));
  refCache().refCnaes = cacheSet(value);
  return value;
}

async function loadPresets(): Promise<NichePreset[]> {
  const hit = cacheGet(refCache().presets);
  if (hit) return hit;
  const { rows } = await query("select * from niche_presets order by ordem, nome");
  const value = rows.map(mapPreset);
  refCache().presets = cacheSet(value);
  return value;
}

async function loadAllPresetCnaes(): Promise<NichePresetCnae[]> {
  const hit = cacheGet(refCache().presetCnaes);
  if (hit) return hit;
  const { rows } = await query(
    "select preset_id, cnae, incluido from niche_preset_cnaes",
  );
  const value = rows.map((r) => ({
    preset_id: String(r.preset_id),
    cnae: trimChar(r.cnae),
    incluido: Boolean(r.incluido),
  }));
  refCache().presetCnaes = cacheSet(value);
  return value;
}

async function loadPresetCnaes(presetId?: string) {
  const all = await loadAllPresetCnaes();
  return presetId ? all.filter((r) => r.preset_id === presetId) : all;
}

async function publicRelationState(
  relname: string,
): Promise<"missing" | "unpopulated" | "ready"> {
  try {
    const { rows } = await query<{ relkind: string; relispopulated: boolean }>(
      `select c.relkind, c.relispopulated
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = $1
       limit 1`,
      [relname],
    );
    const row = rows[0];
    if (!row) return "missing";
    if (row.relkind === "m" && !row.relispopulated) return "unpopulated";
    return "ready";
  } catch (err) {
    if (isMissingOrUnpopulatedRelationError(err)) return "missing";
    throw err;
  }
}

async function hasCnaeUfCount(): Promise<boolean> {
  const hit = cacheGet(refCache().cnaeUfCount);
  if (hit != null) return hit;
  const state = await publicRelationState("cnae_uf_count");
  if (state !== "ready") {
    refCache().cnaeUfCount = cacheSet(false);
    return false;
  }
  try {
    const { rows } = await query("select 1 from cnae_uf_count limit 1");
    const ok = rows.length > 0;
    refCache().cnaeUfCount = cacheSet(ok);
    return ok;
  } catch (err) {
    if (isMissingOrUnpopulatedRelationError(err)) {
      refCache().cnaeUfCount = cacheSet(false);
      return false;
    }
    throw err;
  }
}

function logSearchDuration(op: string, started: number, extra?: Record<string, unknown>) {
  const ms = Date.now() - started;
  console.log(JSON.stringify({ event: "search_timing", op, ms, ...extra }));
  if (ms > 5000) {
    console.warn(JSON.stringify({ event: "search_slow", op, ms, ...extra }));
  }
}

async function hasEstablishmentsSearch(): Promise<boolean> {
  const hit = cacheGet(refCache().establishmentsSearch);
  if (hit != null) return hit;
  try {
    const state = await publicRelationState("establishments_search");
    if (state !== "ready") {
      refCache().establishmentsSearch = cacheSet(false);
      return false;
    }
    const { rows } = await querySearch("select 1 from establishments_search limit 1");
    const ok = rows.length > 0;
    refCache().establishmentsSearch = cacheSet(ok);
    return ok;
  } catch (err) {
    if (isMissingOrUnpopulatedRelationError(err)) {
      refCache().establishmentsSearch = cacheSet(false);
      return false;
    }
    throw err;
  }
}

async function countViaCnaeUfMv(
  filters: SearchFilters,
  allowed: Set<string>,
): Promise<CountResult | null> {
  if (!(await hasCnaeUfCount())) return null;
  try {
    const params: unknown[] = [cnaeChar7Params([...allowed])];
    let ufSql = "";
    if (filters.ufs.length) {
      params.push(ufChar2Params(filters.ufs));
      ufSql = ` and uf = any($${params.length}::char(2)[])`;
    }
    const { rows } = await querySearch<{ n: number }>(
      `select coalesce(sum(n), 0)::int as n
       from cnae_uf_count
       where cnae_principal = any($1::char(7)[])${ufSql}`,
      params,
    );
    const raw = Number(rows[0]?.n ?? 0);
    const capped = raw > COUNT_CAP;
    return {
      total: capped ? COUNT_CAP : raw,
      capped,
      comTelefone: 0,
      comEmail: 0,
      comDecisor: 0,
      porMunicipio: [],
    };
  } catch (err) {
    if (
      !isMissingOrUnpopulatedRelationError(err) &&
      !isStatementTimeoutError(err)
    ) {
      throw err;
    }
    return null;
  }
}

async function countCached(
  filters: SearchFilters,
  mode: "total" | "full",
  allowed: Set<string> | null,
): Promise<CountResult> {
  const key = countCacheKey(filters, mode, allowed);
  const cached = await getCountCache(key);
  if (cached) {
    logSearchDuration("count", Date.now(), { mode, cache: true });
    return cached;
  }

  return withCountSingleFlight(key, () => computeCount(filters, mode, allowed, key), () =>
    getCountCache(key),
  );
}

async function computeCount(
  filters: SearchFilters,
  mode: "total" | "full",
  allowed: Set<string> | null,
  key: string,
): Promise<CountResult> {
  const cached = await getCountCache(key);
  if (cached) {
    logSearchDuration("count", Date.now(), { mode, cache: true });
    return cached;
  }

  return withCountSlot(async () => {
    const again = await getCountCache(key);
    if (again) {
      logSearchDuration("count", Date.now(), { mode, cache: true });
      return again;
    }

    const started = Date.now();
    let result: CountResult;
    const useFlat = await hasEstablishmentsSearch();

    if (mode === "total" && allowed && canFastCountPreview(filters, allowed)) {
      const mv = await countViaCnaeUfMv(filters, allowed);
      if (mv) {
        logSearchDuration("count", started, { mode, mv: true, total: mv.total });
        await setCountCache(key, mv);
        return mv;
      }
    }

    if (useFlat) {
      const includeStats = mode === "full";
      const cap = mode === "full" ? COUNT_CAP : FLAT_COUNT_PREVIEW_CAP;
      result = await countViaFlatTable(filters, allowed, { includeStats, cap });
    } else if (mode === "total") {
      result = await countTotalPreviewLegacy(filters, allowed);
    } else {
      result = await countFullLegacy(filters, allowed);
    }

    logSearchDuration("count", started, { mode, flat: useFlat, total: result.total });
    await setCountCache(key, result);
    return result;
  });
}

async function countFullLegacy(
  filters: SearchFilters,
  allowed: Set<string> | null,
): Promise<CountResult> {
  const useFast = canFastCount(filters, allowed);
  if (useFast && (await hasCnaeUfCount())) {
    try {
      const params: unknown[] = [cnaeChar7Params([...allowed!])];
      let ufSql = "";
      if (filters.ufs.length) {
        params.push(ufChar2Params(filters.ufs));
        ufSql = ` and uf = any($${params.length}::char(2)[])`;
      }
      const { rows } = await querySearch<{ n: number }>(
        `select coalesce(sum(n), 0)::int as n
         from cnae_uf_count
         where cnae_principal = any($1::char(7)[])${ufSql}`,
        params,
      );
      const total = Number(rows[0]?.n ?? 0);
      const capped = total > COUNT_CAP;
      return {
        total: capped ? COUNT_CAP : total,
        capped,
        comTelefone: 0,
        comEmail: 0,
        comDecisor: 0,
        porMunicipio: [],
      };
    } catch (err) {
      if (
        !isMissingOrUnpopulatedRelationError(err) &&
        !isStatementTimeoutError(err)
      ) {
        throw err;
      }
    }
  }
  const { sql, params } = buildFilterSql(filters, allowed);
  const fromSql = buildMatchFrom(filters);
  const limitParam = params.length + 1;
  const { rows } = await querySearch<{
    total_probe: number;
    com_telefone: number;
    com_email: number;
    com_decisor: number;
    por_municipio: MunicipioCountRow[] | null;
  }>(
    `with matched as (
       select e.cnpj, e.cnpj_basico, e.municipio_id, e.telefone1, e.email
       ${fromSql}
       where ${sql}
       limit $${limitParam}
     ),
     capped_matched as (
       select * from matched
       limit ${COUNT_CAP}
     ),
     stats as (
       select
         (select count(*)::int from matched) as total_probe,
         count(*) filter (where telefone1 is not null)::int as com_telefone,
         count(*) filter (where email is not null)::int as com_email,
         (
           select count(*)::int from capped_matched m
           where exists (select 1 from partners p where p.cnpj_basico = m.cnpj_basico)
         ) as com_decisor
       from capped_matched
     ),
     top_mun as (
       select m.municipio_id,
              coalesce(r.nome, 'NÃO ENCONTRADO') as nome,
              coalesce(r.uf, '') as uf,
              count(*)::int as total
       from capped_matched m
       left join ref_municipio r on r.id = m.municipio_id
       group by 1, 2, 3
       order by total desc
       limit 5
     )
     select
       s.total_probe,
       s.com_telefone,
       s.com_email,
       s.com_decisor,
       coalesce(
         (select json_agg(json_build_object(
           'municipio_id', t.municipio_id,
           'nome', t.nome,
           'uf', t.uf,
           'total', t.total
         ) order by t.total desc) from top_mun t),
         '[]'::json
       ) as por_municipio
     from stats s`,
    [...params, COUNT_CAP + 1],
  );
  const row = rows[0];
  const raw = Number(row?.total_probe ?? 0);
  const capped = raw > COUNT_CAP;
  const munRows = Array.isArray(row?.por_municipio) ? row.por_municipio : [];
  return {
    total: capped ? COUNT_CAP : raw,
    capped,
    comTelefone: Number(row?.com_telefone ?? 0),
    comEmail: Number(row?.com_email ?? 0),
    comDecisor: Number(row?.com_decisor ?? 0),
    porMunicipio: mapMunicipioCountRows(munRows),
  };
}

function cnaeCountSql(
  source: "mv" | "flat" | "est",
  ufSql: string,
): string {
  if (source === "mv") {
    return `select cnae_principal, sum(n)::int as n
       from cnae_uf_count
       where cnae_principal = any($1::char(7)[])${ufSql}
       group by 1`;
  }
  const table = source === "flat" ? "establishments_search" : "establishments";
  return `select cnae_principal, count(*)::int as n
       from ${table}
       where cnae_principal = any($1::char(7)[])${ufSql}
       group by 1`;
}

async function countCnaesByCode(
  codes: string[],
  ufs: string[],
): Promise<Map<string, number>> {
  if (!codes.length) return new Map();
  const params: unknown[] = [cnaeChar7Params(codes)];
  let ufSql = "";
  if (ufs.length) {
    params.push(ufChar2Params(ufs));
    ufSql = ` and uf = any($${params.length}::char(2)[])`;
  }

  const order: Array<"mv" | "flat" | "est"> = ["mv", "flat", "est"];
  let lastErr: unknown;
  for (let i = 0; i < order.length; i++) {
    const source = order[i]!;
    if (source === "mv" && !(await hasCnaeUfCount())) continue;
    if (source === "flat" && !(await hasEstablishmentsSearch())) continue;
    try {
      const run = source === "est" ? querySearch : query;
      const { rows } = await run<{ cnae_principal: string; n: number }>(
        cnaeCountSql(source, ufSql),
        params,
      );
      return new Map(rows.map((r) => [trimChar(r.cnae_principal), Number(r.n)]));
    } catch (err) {
      lastErr = err;
      const canFallback =
        i < order.length - 1 &&
        (isMissingOrUnpopulatedRelationError(err) || isStatementTimeoutError(err));
      if (canFallback) {
        console.warn(
          JSON.stringify({ event: "count_cnae_fallback", from: source, code: pgErrorCode(err) }),
        );
        continue;
      }
      throw err;
    }
  }
  if (lastErr) throw lastErr;
  return new Map();
}

async function countPresetsInRegion(
  presetIds: string[],
  ufs: string[],
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (!presetIds.length) return result;

  const presets = await loadPresets();
  const byId = new Map(presets.map((p) => [p.id, p]));
  const segmentIds = new Set<string>();

  for (const id of presetIds) {
    const preset = byId.get(id);
    if (!preset) continue;
    if (!preset.parent_id) {
      const children = presets.filter((p) => p.parent_id === id);
      if (children.length) {
        for (const child of children) segmentIds.add(child.id);
        continue;
      }
    }
    segmentIds.add(id);
  }

  const [curated, refCnaes] = await Promise.all([
    loadAllPresetCnaes(),
    loadRefCnaes(),
  ]);
  const cnaesByPreset = new Map<string, string[]>();
  const allCnaes = new Set<string>();
  for (const id of segmentIds) {
    const preset = byId.get(id);
    if (!preset) continue;
    const codes = resolvePresetCnaes(preset, curated, refCnaes);
    cnaesByPreset.set(id, codes);
    for (const code of codes) allCnaes.add(code);
  }

  const counts = await countCnaesByCode([...allCnaes], ufs);
  for (const id of segmentIds) {
    const codes = cnaesByPreset.get(id) ?? [];
    result[id] = codes.reduce((sum, code) => sum + (counts.get(code) ?? 0), 0);
  }
  for (const id of presetIds) {
    const preset = byId.get(id);
    if (!preset || preset.parent_id) continue;
    const children = presets.filter((p) => p.parent_id === id);
    if (children.length) {
      result[id] = children.reduce((sum, child) => sum + (result[child.id] ?? 0), 0);
    }
  }
  return result;
}

async function loadRefMunicipios(): Promise<RefMunicipio[]> {
  const hit = cacheGet(refCache().refMunicipios);
  if (hit) return hit;
  const { rows } = await query<{ id: number; nome: string; uf: string }>(
    "select id, nome, uf from ref_municipio",
  );
  const value = rows.map((r) => ({
    id: Number(r.id),
    nome: String(r.nome),
    uf: trimChar(r.uf),
  }));
  refCache().refMunicipios = cacheSet(value);
  return value;
}

async function loadQuals(): Promise<RefQualificacao[]> {
  const hit = cacheGet(refCache().quals);
  if (hit) return hit;
  const { rows } = await query<{ id: number; descricao: string }>(
    "select id, descricao from ref_qualificacao",
  );
  const value = rows.map((r) => ({ id: Number(r.id), descricao: r.descricao }));
  refCache().quals = cacheSet(value);
  return value;
}

async function resolveAllowedCnaes(filters: SearchFilters): Promise<Set<string> | null> {
  const [presets, refCnaes, curated] = await Promise.all([
    loadPresets(),
    loadRefCnaes(),
    loadPresetCnaes(),
  ]);

  let scoped: Set<string> | null = null;

  if (filters.segmentIds.length) {
    const codes = new Set<string>();
    for (const id of filters.segmentIds) {
      const preset = presets.find((p) => p.id === id);
      if (!preset) continue;
      for (const c of resolvePresetCnaes(preset, curated, refCnaes)) codes.add(c);
    }
    scoped = codes.size ? codes : new Set(["__none__"]);
  } else if (filters.intentQuery && filters.intentQuery.trim().length >= 2) {
    const matched: RefCnae[] = refCnaes.filter((c) =>
      cnaeMatchesQuery(c.codigo, c.descricao, filters.intentQuery!),
    );
    for (const p of presets) {
      if (!p.parent_id) continue;
      if (presetMatchesQuery(p, filters.intentQuery)) {
        matched.push(...resolveCnaesFromKeywords(p.keywords, p.exclusoes, refCnaes));
      }
    }
    const codes = new Set(matched.map((c) => c.codigo));
    scoped = codes.size ? codes : new Set(["__none__"]);
  } else if (filters.presetId) {
    const preset = presets.find((p) => p.id === filters.presetId);
    if (preset) {
      const codes = resolvePresetCnaes(preset, curated, refCnaes);
      scoped = codes.length ? new Set(codes) : new Set(["__none__"]);
    }
  }

  return combineActivityCnaes(filters.cnaes, scoped);
}

async function scoreProfileForFilters(filters: SearchFilters): Promise<ScoreProfile> {
  const id = filters.segmentIds[0] ?? filters.presetId;
  if (!id) return "b2c_local";
  const { rows } = await query("select perfil_score from niche_presets where id = $1", [id]);
  return rows[0]?.perfil_score === "b2b_industria" ? "b2b_industria" : "b2c_local";
}

type PhoneMeta = { qtd: number; verdict: SharedPhoneVerdict };

async function phoneMeta(
  pairs: Array<{ ddd: string | null; tel: string | null }>,
): Promise<Map<string, PhoneMeta>> {
  const keys = [
    ...new Set(
      pairs
        .filter((p) => p.ddd && p.tel)
        .map((p) => `${p.ddd}|${p.tel}`),
    ),
  ];
  const map = new Map<string, PhoneMeta>();
  if (!keys.length) return map;
  const ddds: string[] = [];
  const tels: string[] = [];
  for (const key of keys) {
    const split = key.indexOf("|");
    ddds.push(key.slice(0, split));
    tels.push(key.slice(split + 1));
  }
  const { rows } = await query<{
    ddd1: string;
    telefone1: string;
    qtd_empresas: number;
    verdict: SharedPhoneVerdict | null;
  }>(
    `select u.ddd1, u.telefone1, u.qtd_empresas, v.verdict
     from unnest($1::text[], $2::text[]) as k(ddd1, telefone1)
     join phone_usage u
       on u.ddd1 = k.ddd1 and u.telefone1 = k.telefone1
     left join phone_shared_verdict v
       on v.ddd1 = u.ddd1 and v.telefone1 = u.telefone1`,
    [ddds, tels],
  );
  for (const r of rows) {
    map.set(`${r.ddd1}|${r.telefone1}`, {
      qtd: Number(r.qtd_empresas),
      verdict: r.verdict ?? "proprio",
    });
  }
  return map;
}

function buildContacts(
  cnpj: string,
  ddd1: string | null,
  tel1: string | null,
  ddd2: string | null,
  tel2: string | null,
  meta: Map<string, PhoneMeta>,
): ContactInfo[] {
  const contacts: ContactInfo[] = [];
  const push = (ddd: string | null, tel: string | null) => {
    if (!ddd || !tel) return;
    const info = meta.get(`${ddd}|${tel}`) ?? { qtd: 1, verdict: "proprio" as const };
    const { seal, label } = phoneSealFromUsage(info.qtd, undefined, info.verdict);
    contacts.push({
      ddd,
      telefone: tel,
      seal,
      sharedCount: info.qtd,
      sharedVerdict: info.verdict,
      label,
      source: seal === "ATUALIZADO" ? "site" : "receita",
    });
  };
  push(ddd1, tel1);
  push(ddd2, tel2);
  contacts.sort((a, b) => sealRank(b.seal) - sealRank(a.seal));
  return contacts;
}

function scoreRow(
  est: Establishment,
  company: Company,
  partners: Partner[],
  quals: RefQualificacao[],
  contacts: ContactInfo[],
  enrichment: LeadEnrichment | null,
  filters: SearchFilters,
  profile: ScoreProfile,
  allowed: Set<string> | null,
): { score: number; decisorNome: string | null } {
  const decisor = pickDecisor(partners, quals);
  const primary = contacts[0];
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
  return { score, decisorNome: decisor?.nome ?? null };
}

async function loadRefsForEstablishments(ests: Establishment[]): Promise<{
  mun: Map<number, RefMunicipio>;
  cnae: Map<string, RefCnae>;
}> {
  const munIds = [...new Set(ests.map((e) => e.municipio_id))];
  const codes = cnaeChar7Params(ests.map((e) => e.cnae_principal));
  const [munRes, cnaeRes] = await allQueries([
    () =>
      munIds.length
        ? query<{ id: number; nome: string; uf: string }>(
            "select id, nome, uf from ref_municipio where id = any($1::int[])",
            [munIds],
          )
        : Promise.resolve({
            rows: [] as Array<{ id: number; nome: string; uf: string }>,
          }),
    () =>
      codes.length
        ? query<{ codigo: string; descricao: string }>(
            "select codigo, descricao from ref_cnae where codigo = any($1::char(7)[])",
            [codes],
          )
        : Promise.resolve({
            rows: [] as Array<{ codigo: string; descricao: string }>,
          }),
  ]);
  return {
    mun: new Map(
      munRes.rows.map((m) => [
        Number(m.id),
        { id: Number(m.id), nome: String(m.nome), uf: trimChar(m.uf) },
      ]),
    ),
    cnae: new Map(
      cnaeRes.rows.map((c) => {
        const codigo = trimChar(c.codigo);
        return [codigo, { codigo, descricao: String(c.descricao ?? "") }];
      }),
    ),
  };
}

async function fetchByCnpjs(
  cnpjs: string[],
  preloadedEsts?: Establishment[],
) {
  if (!cnpjs.length) {
    return {
      ests: [] as Establishment[],
      companies: new Map<string, Company>(),
      partners: new Map<string, Partner[]>(),
      quals: [] as RefQualificacao[],
      mun: new Map<number, RefMunicipio>(),
      cnae: new Map<string, RefCnae>(),
      enrichment: new Map<string, LeadEnrichment>(),
    };
  }
  // char(14)/char(8) PKs: `= any($1::text[])` casts the column to text and
  // sequential-scans RF tables (~30s timeout). Keep the parameter typed.
  const padded = cnpjChar14Params(cnpjs);
  const basicos = [
    ...new Set(
      (preloadedEsts?.map((e) => e.cnpj_basico) ?? padded.map((c) => c.slice(0, 8)))
        .map((b) => b.replace(/\D/g, "").padStart(8, "0")),
    ),
  ];
  const [ests, companyRes, partRes, quals, enrRes] = await allQueries([
    () =>
      preloadedEsts
        ? Promise.resolve(preloadedEsts)
        : query(
            `select * from establishments where cnpj = any($1::char(14)[])`,
            [padded],
          ).then((r) => r.rows.map(mapEstablishment)),
    () =>
      query(
        `select * from companies where cnpj_basico = any($1::char(8)[])`,
        [basicos],
      ),
    () =>
      query(
        `select * from partners where cnpj_basico = any($1::char(8)[])`,
        [basicos],
      ),
    () => loadQuals(),
    () =>
      query(
        `select * from lead_enrichment where cnpj = any($1::char(14)[])`,
        [padded],
      ),
  ]);
  const refs = await loadRefsForEstablishments(ests);
  const companies = new Map<string, Company>();
  for (const r of companyRes.rows) {
    const company = mapCompany(r);
    companies.set(company.cnpj_basico, company);
  }
  const partners = new Map<string, Partner[]>();
  for (const r of partRes.rows) {
    const p = mapPartner(r);
    const list = partners.get(p.cnpj_basico) ?? [];
    list.push(p);
    partners.set(p.cnpj_basico, list);
  }
  return {
    ests,
    companies,
    partners,
    quals,
    mun: refs.mun,
    cnae: refs.cnae,
    enrichment: new Map(
      enrRes.rows.map((r) => {
        const row = mapEnrichment(r);
        return [row.cnpj, row] as const;
      }),
    ),
  };
}

async function countUnaudited(searchId: string, userId: string, fallback: number): Promise<number> {
  try {
    const { rows } = await query<{ n: number }>(
      `select count(*)::int as n
       from saved_leads sl
       where sl.search_id = $1
         and not exists (
           select 1 from billed_cnpjs b
            where b.profile_id = $2
              and b.kind = 'enrich'
              and rtrim(b.cnpj) = rtrim(sl.cnpj)
         )
         and not exists (
           select 1 from enrichment_jobs j
            where j.search_id = sl.search_id
              and rtrim(j.cnpj) = rtrim(sl.cnpj)
              and j.status in ('done', 'skipped')
         )`,
      [searchId, userId],
    );
    return Number(rows[0]?.n ?? fallback);
  } catch {
    return fallback;
  }
}

async function overlayGridRows(
  searchId: string,
  userId: string,
  rows: GridRow[],
): Promise<GridRow[]> {
  if (!rows.length) return rows;
  const paddedCnpjs = cnpjChar14Params(rows.map((r) => r.cnpj));
  const [jobRes, auditRes, billedRes] = await allQueries([
    () =>
      query(
        `select distinct on (cnpj) *
         from enrichment_jobs
         where search_id = $1 and cnpj = any($2::char(14)[])
         order by cnpj, created_at desc`,
        [searchId, paddedCnpjs],
      ),
    () =>
      query(
        `select * from lead_enrichment
         where cnpj = any($1::char(14)[]) and expires_at > now()
           and (stage is null or stage = 'complete')`,
        [paddedCnpjs],
      ),
    () =>
      query<{ cnpj: string }>(
        `select cnpj from billed_cnpjs
          where profile_id = $1 and kind = 'enrich' and cnpj = any($2::char(14)[])`,
        [userId, paddedCnpjs],
      ).catch(() => ({ rows: [] as Array<{ cnpj: string }> })),
  ]);
  const jobs = new Map(jobRes.rows.map((j) => [trimChar(j.cnpj), mapJob(j)]));
  const enrichmentByCnpj = new Map(
    auditRes.rows.map((r) => [trimChar(r.cnpj), mapEnrichment(r)] as const),
  );
  const billed = new Set(billedRes.rows.map((r) => trimChar(r.cnpj)));
  return rows.map((row) => {
    const job = jobs.get(row.cnpj);
    const ownedJob = job?.status === "done" || job?.status === "skipped";
    const hasAudit = billed.has(row.cnpj) || ownedJob;
    const enrichment = hasAudit ? enrichmentByCnpj.get(row.cnpj) : undefined;
    const phone = overlayGridPhone(
      {
        telefone: row.telefone,
        seal: row.seal,
        sharedCount: row.sharedCount,
        sharedVerdict: row.sharedVerdict,
      },
      enrichment,
    );
    return {
      ...row,
      telefone: phone.telefone,
      seal: phone.seal,
      sharedCount: phone.sharedCount,
      sharedVerdict: phone.sharedVerdict,
      enrichmentStatus:
        job?.status ?? (enrichment ? "done" : row.enrichmentStatus),
      hasAudit,
    };
  });
}

async function rowsFromReceita(
  cnpjs: string[],
  leads: Map<string, { gridScore: number; gridPosition: number }>,
): Promise<Map<string, GridRow>> {
  const packed = await fetchByCnpjs(cnpjs);
  const meta = await phoneMeta(
    packed.ests.flatMap((e) => [
      { ddd: e.ddd1, tel: e.telefone1 },
      { ddd: e.ddd2, tel: e.telefone2 },
    ]),
  );
  const out = new Map<string, GridRow>();
  for (const est of packed.ests) {
    const company = packed.companies.get(est.cnpj_basico);
    if (!company) continue;
    const lead = leads.get(est.cnpj) ?? leads.get(trimChar(est.cnpj));
    if (!lead) continue;
    const contacts = buildContacts(
      est.cnpj,
      est.ddd1,
      est.telefone1,
      est.ddd2,
      est.telefone2,
      meta,
    );
    const primary = contacts[0];
    const partners = packed.partners.get(est.cnpj_basico) ?? [];
    const decisor = pickDecisor(partners, packed.quals);
    const hasAudit = false;
    const phone = overlayGridPhone(
      {
        telefone: primary ? `${primary.ddd}${primary.telefone}` : null,
        seal: primary?.seal ?? "NAO_CONFIRMADO",
        sharedCount: primary?.sharedCount ?? 0,
        sharedVerdict: primary?.sharedVerdict,
      },
      null,
    );
    const row: GridRow = {
      cnpj: est.cnpj,
      razaoSocial: company.razao_social,
      nomeFantasia: est.nome_fantasia,
      municipio: packed.mun.get(est.municipio_id)?.nome ?? "NÃO ENCONTRADO",
      uf: est.uf,
      cnaeCodigo: est.cnae_principal,
      cnaeDescricao:
        packed.cnae.get(est.cnae_principal)?.descricao ?? "NÃO ENCONTRADO",
      telefone: phone.telefone,
      seal: phone.seal,
      sharedCount: phone.sharedCount,
      sharedVerdict: phone.sharedVerdict,
      decisorNome: decisor?.nome ?? null,
      porte: company.porte,
      email: est.email?.trim() || null,
      gridScore: lead.gridScore,
      gridPosition: lead.gridPosition,
      enrichmentStatus: hasAudit ? "done" : null,
      hasAudit,
    };
    out.set(est.cnpj, row);
    out.set(trimChar(est.cnpj), row);
  }
  return out;
}

async function searchSlugsFor(searchId: string): Promise<{
  presetSlug: string | null;
  parentSlug: string | null;
}> {
  const [searchRes, presets] = await Promise.all([
    query("select * from searches where id = $1", [searchId]),
    loadPresets(),
  ]);
  const search = searchRes.rows[0] ? mapSearch(searchRes.rows[0]) : undefined;
  return slugsFromSearch(search?.filtros, presets);
}

async function dossierOf(cnpj: string, searchId?: string): Promise<LeadDossier | null> {
  const started = Date.now();
  const padded = digitsCnpj(cnpj);
  const packed = await fetchByCnpjs([padded]);
  const est = packed.ests[0];
  if (!est) return null;
  const company = packed.companies.get(est.cnpj_basico);
  if (!company) return null;
  const partners = packed.partners.get(est.cnpj_basico) ?? [];
  const email = est.email;

  const [meta, savedRes, emailRow, addrRow, jobRes, slugs] = await Promise.all([
    phoneMeta([
      { ddd: est.ddd1, tel: est.telefone1 },
      { ddd: est.ddd2, tel: est.telefone2 },
    ]),
    searchId
      ? query(
          "select * from saved_leads where search_id = $1 and cnpj = $2::char(14)",
          [searchId, padded],
        )
      : query(
          "select * from saved_leads where cnpj = $1::char(14) order by created_at desc limit 1",
          [padded],
        ),
    email
      ? query<{ qtd: number }>(
          "select qtd_empresas as qtd from email_usage where email = lower($1)",
          [email],
        )
      : Promise.resolve({ rows: [] as Array<{ qtd: number }> }),
    est.cep && est.logradouro && est.numero
      ? query<{ qtd: number }>(
          `select qtd_empresas as qtd from address_usage
           where cep = $1 and logradouro = $2 and numero = $3`,
          [est.cep, est.logradouro, est.numero],
        )
      : Promise.resolve({ rows: [] as Array<{ qtd: number }> }),
    query(
      `select * from enrichment_jobs
       where cnpj = $1::char(14)
       order by created_at desc
       limit 1`,
      [padded],
    ),
    searchId
      ? searchSlugsFor(searchId)
      : Promise.resolve({ presetSlug: null as string | null, parentSlug: null as string | null }),
  ]);

  const enrichmentRaw = packed.enrichment.get(est.cnpj) ?? null;
  const enrichment = isEnrichmentVisible(enrichmentRaw) ? enrichmentRaw : null;

  let contacts = buildContacts(
    est.cnpj,
    est.ddd1,
    est.telefone1,
    est.ddd2,
    est.telefone2,
    meta,
  );
  if (enrichment?.phones.length) {
    contacts = contactsFromEnrichmentPhones(enrichment.phones);
  }

  const saved = savedRes.rows[0];
  const emailCount = email ? Number(emailRow.rows[0]?.qtd ?? 1) : 0;
  const addrCount =
    est.cep && est.logradouro && est.numero
      ? Number(addrRow.rows[0]?.qtd ?? 1)
      : 0;
  const decisorPartner = pickDecisor(partners, packed.quals);
  const cnaeDescricao =
    packed.cnae.get(est.cnae_principal)?.descricao ?? "NÃO ENCONTRADO";
  const municipioNome =
    packed.mun.get(est.municipio_id)?.nome ?? "NÃO ENCONTRADO";
  const market = resolveMarketBrief({
    presetSlug: slugs.presetSlug,
    parentSlug: slugs.parentSlug,
    cnaeDescricao,
    municipioNome,
  });
  const pontePack = resolveMarketPackForPonte({
    presetSlug: slugs.presetSlug,
    parentSlug: slugs.parentSlug,
    cnaeDescricao,
    municipioNome,
  });
  const latestJob = jobRes.rows[0] ? mapJob(jobRes.rows[0]) : null;

  const dossier: LeadDossier = {
    establishment: est,
    company,
    cnaeDescricao,
    municipioNome,
    contacts,
    emailSeal: {
      email,
      shared: Number(emailCount) >= 3,
      free: isFreeEmail(email),
      accountantHint: hasAccountantDomainHint(email),
    },
    addressSharedCount: Number(addrCount),
    decisor: decisorPartner
      ? {
          nome: decisorPartner.nome,
          qualificacao: qualificacaoLabel(
            decisorPartner.qualificacao_id,
            packed.quals,
          ),
          dataEntrada: decisorPartner.data_entrada,
          faixaEtaria: decisorPartner.faixa_etaria,
        }
      : null,
    socios: toPartnerCards(partners, packed.quals),
    gridScore: saved ? Number(saved.grid_score ?? 0) : 0,
    gridPosition: saved?.grid_position == null ? null : Number(saved.grid_position),
    status: (saved?.status as LeadStatus) ?? "novo",
    notas: saved?.notas == null ? null : String(saved.notas),
    savedLeadId: saved ? String(saved.id) : null,
    enrichment,
    enrichmentJobStatus: latestJob?.status ?? null,
    market,
    goldenMinute: buildGoldenMinute(enrichment, pontePack),
  };
  logSearchDuration("dossier", started, { searchId: Boolean(searchId) });
  return dossier;
}

function byteaToB64(value: unknown): string {
  if (!value) return "";
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (typeof value === "string") {
    if (/^[0-9a-f]+$/i.test(value) && value.length % 2 === 0) {
      return Buffer.from(value, "hex").toString("base64");
    }
    return value;
  }
  return "";
}

function mapIntegrationConnection(r: Record<string, unknown>): IntegrationConnectionRecord {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    provider: String(r.provider) as IntegrationProvider,
    kind: String(r.kind) as IntegrationKind,
    display_name: r.display_name == null ? null : String(r.display_name),
    status: String(r.status) as IntegrationConnectionRecord["status"],
    credentials_ciphertext: byteaToB64(r.credentials_ciphertext),
    credentials_nonce: byteaToB64(r.credentials_nonce),
    oauth_expires_at: r.oauth_expires_at == null ? null : isoStr(r.oauth_expires_at),
    caller_id: r.caller_id == null ? null : String(r.caller_id),
    config:
      r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {},
    created_at: isoStr(r.created_at),
    updated_at: isoStr(r.updated_at),
  };
}

function mapIntegrationJob(r: Record<string, unknown>): IntegrationJobRecord {
  return {
    id: Number(r.id),
    user_id: String(r.user_id),
    connection_id: String(r.connection_id),
    search_id: r.search_id == null ? null : String(r.search_id),
    verb: r.verb === "originate_call" ? "originate_call" : "push_list",
    provider: String(r.provider) as IntegrationProvider,
    status: String(r.status) as IntegrationJobRecord["status"],
    attempts: Number(r.attempts ?? 0),
    last_error: r.last_error == null ? null : String(r.last_error),
    payload:
      r.payload && typeof r.payload === "object"
        ? (r.payload as Record<string, unknown>)
        : null,
    result:
      r.result && typeof r.result === "object"
        ? (r.result as Record<string, unknown>)
        : null,
    locked_at: r.locked_at == null ? null : isoStr(r.locked_at),
    created_at: isoStr(r.created_at),
    finished_at: r.finished_at == null ? null : isoStr(r.finished_at),
  };
}

type CompanyHitRow = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  municipio: string | null;
  uf: string;
  cnae_principal: string;
  cnae_descricao: string | null;
  ddd1: string | null;
  telefone1: string | null;
};

function mapCompanySearchHit(r: CompanyHitRow): CompanySearchHit {
  return {
    cnpj: trimChar(r.cnpj),
    razaoSocial: String(r.razao_social ?? ""),
    nomeFantasia: r.nome_fantasia,
    municipio: r.municipio ?? "NÃO ENCONTRADO",
    uf: trimChar(r.uf),
    cnaeCodigo: trimChar(r.cnae_principal) || null,
    cnaeDescricao: r.cnae_descricao ?? "NÃO ENCONTRADO",
    telefone: r.ddd1 && r.telefone1 ? `${r.ddd1}${r.telefone1}` : null,
    decisorNome: null,
  };
}

async function attachDecisorsToCompanyHits(
  hits: CompanySearchHit[],
): Promise<CompanySearchHit[]> {
  if (!hits.length) return hits;
  try {
    const basicos = [...new Set(hits.map((h) => h.cnpj.slice(0, 8)))];
    const quals = await loadQuals();
    const { rows } = await query(
      `select * from partners where cnpj_basico = any($1::char(8)[])`,
      [basicos],
    );
    const byBasico = new Map<string, Partner[]>();
    for (const row of rows) {
      const p = mapPartner(row);
      const list = byBasico.get(p.cnpj_basico) ?? [];
      list.push(p);
      byBasico.set(p.cnpj_basico, list);
    }
    return hits.map((h) => {
      const partners = byBasico.get(h.cnpj.slice(0, 8)) ?? [];
      const decisor = pickDecisor(partners, quals);
      return { ...h, decisorNome: decisor?.nome ?? null };
    });
  } catch (err) {
    console.warn("company_search_decisor_error", err);
    return hits;
  }
}

function companySearchExtraSql(
  params: unknown[],
  ufs: string[],
  soMatriz: boolean,
  alias: "e" | "es" = "e",
): string {
  const extra: string[] = [];
  if (ufs.length) {
    if (alias === "es") {
      params.push(ufChar2Params(ufs));
      extra.push(`${alias}.uf = any($${params.length}::char(2)[])`);
    } else {
      params.push(ufs);
      extra.push(`${alias}.uf = any($${params.length}::text[])`);
    }
  }
  if (soMatriz) extra.push(`${alias}.is_matriz = true`);
  return extra.length ? ` and ${extra.join(" and ")}` : "";
}

const COMPANY_HIT_SELECT = `select e.cnpj, c.razao_social, e.nome_fantasia,
              r.nome as municipio, e.uf, e.cnae_principal,
              rc.descricao as cnae_descricao, e.ddd1, e.telefone1
       from hits h
       join establishments e on e.cnpj = h.cnpj
       join companies c on c.cnpj_basico = e.cnpj_basico
       left join ref_municipio r on r.id = e.municipio_id
       left join ref_cnae rc on rc.codigo = e.cnae_principal`;

const COMPANY_HIT_SELECT_FLAT = `select es.cnpj, es.razao_social, es.nome_fantasia,
              r.nome as municipio, es.uf, es.cnae_principal,
              rc.descricao as cnae_descricao, es.ddd1, es.telefone1
       from hits h
       join establishments_search es on es.cnpj = h.cnpj
       left join ref_municipio r on r.id = es.municipio_id
       left join ref_cnae rc on rc.codigo = es.cnae_principal`;

async function searchCompaniesByCnpj(
  queryText: string,
  ufs: string[],
  soMatriz: boolean,
  limit: number,
): Promise<CompanySearchHit[]> {
  const digits = queryText.replace(/\D/g, "");
  const padded = digits.padStart(14, "0");
  const basico = digits.slice(0, 8);
  const params: unknown[] = [padded, `${digits}%`, basico];
  const extra = companySearchExtraSql(params, ufs, soMatriz);
  params.push(limit);
  const { rows } = await querySearch<CompanyHitRow>(
    `with hits as (
       select e.cnpj
       from establishments e
       where (e.cnpj = $1 or e.cnpj like $2 or e.cnpj_basico = $3)
       ${extra}
       limit $${params.length}
     )
     ${COMPANY_HIT_SELECT}
     order by e.is_matriz desc
     limit $${params.length}`,
    params,
  );
  return rows.map(mapCompanySearchHit);
}

async function runCompanyNameWave(
  wave: () => Promise<CompanySearchHit[]>,
  op: string,
): Promise<{ hits: CompanySearchHit[]; timedOut: boolean }> {
  try {
    return { hits: await wave(), timedOut: false };
  } catch (err) {
    if (isStatementTimeoutError(err)) {
      console.warn(
        JSON.stringify({ event: "search_slow", op, timeout: true }),
      );
      return { hits: [], timedOut: true };
    }
    throw err;
  }
}

async function searchCompaniesNameWaveFlat(
  mode: "prefix" | "tokens",
  queryText: string,
  ufs: string[],
  soMatriz: boolean,
  limit: number,
): Promise<CompanySearchHit[]> {
  const tokens = companyIlikeTokens(queryText);
  if (!tokens.length) return [];
  const phrase = tokens.join(" ");
  const razao = "es.razao_social";
  const fantasia = "coalesce(es.nome_fantasia, '')";
  const params: unknown[] = [phrase];
  const tokenSql: string[] = [];
  for (const token of tokens) {
    params.push(`%${escapeIlike(token)}%`);
    const p = `$${params.length}`;
    tokenSql.push(
      `(${razao} ilike ${p} escape '\\' or ${fantasia} ilike ${p} escape '\\')`,
    );
  }
  const tokenWhere = tokenSql.join(" and ");
  let prefixSql = "";
  if (mode === "prefix") {
    params.push(`${escapeIlike(phrase)}%`);
    const p = `$${params.length}`;
    prefixSql = `and (${razao} ilike ${p} escape '\\' or ${fantasia} ilike ${p} escape '\\')`;
  }
  const extra = companySearchExtraSql(params, ufs, soMatriz, "es");
  params.push(limit);
  const limitRef = `$${params.length}`;
  const { rows } = await querySearchWithTimeout<CompanyHitRow>(
    `with hits as (
       select es.cnpj
       from establishments_search es
       where ${tokenWhere}
       ${prefixSql}
       ${extra}
       limit ${limitRef}
     )
     ${COMPANY_HIT_SELECT_FLAT}
     order by
       (${razao} ilike $1 || '%' escape '\\'
         or ${fantasia} ilike $1 || '%' escape '\\') desc,
       es.is_matriz desc,
       greatest(similarity(${razao}, $1), similarity(${fantasia}, $1)) desc
     limit ${limitRef}`,
    params,
    COMPANY_NAME_SEARCH_TIMEOUT_MS,
  );
  return rows.map(mapCompanySearchHit);
}

async function searchCompaniesNameWaveLegacy(
  mode: "prefix" | "tokens",
  queryText: string,
  ufs: string[],
  soMatriz: boolean,
  limit: number,
): Promise<CompanySearchHit[]> {
  const tokens = companyNameTokens(queryText);
  if (!tokens.length) return [];
  const foldedRazao = sqlFoldAccent("c.razao_social");
  const foldedFantasiaEst = sqlFoldAccent("coalesce(e.nome_fantasia, '')");
  const foldedQuery = tokens.join(" ");
  const params: unknown[] = [foldedQuery];
  const tokenSql: string[] = [];
  for (const token of tokens) {
    params.push(`%${escapeIlike(token)}%`);
    const p = `$${params.length}`;
    tokenSql.push(p);
  }
  const companyTokenWhere = tokenSql
    .map(
      (p) =>
        `(${foldedRazao} like ${p} escape '\\' or ${foldedFantasiaEst} like ${p} escape '\\')`,
    )
    .join(" and ");
  const fantasiaTokenWhere = tokenSql
    .map((p) => `${foldedFantasiaEst} like ${p} escape '\\'`)
    .join(" and ");
  let prefixCompany = "";
  let prefixFantasia = "";
  if (mode === "prefix") {
    params.push(`${escapeIlike(foldedQuery)}%`);
    const p = `$${params.length}`;
    prefixCompany = `and (${foldedRazao} like ${p} escape '\\' or ${foldedFantasiaEst} like ${p} escape '\\')`;
    prefixFantasia = `and ${foldedFantasiaEst} like ${p} escape '\\'`;
  }
  const extra = companySearchExtraSql(params, ufs, soMatriz);
  params.push(limit);
  const limitRef = `$${params.length}`;
  const { rows } = await querySearchWithTimeout<CompanyHitRow>(
    `with hits as (
       (
         select e.cnpj
         from companies c
         join establishments e on e.cnpj_basico = c.cnpj_basico
         where ${companyTokenWhere}
         ${prefixCompany}
         ${extra}
         limit ${limitRef}
       )
       union
       (
         select e.cnpj
         from establishments e
         where ${fantasiaTokenWhere}
         ${prefixFantasia}
         ${extra}
         limit ${limitRef}
       )
     )
     ${COMPANY_HIT_SELECT}
     order by
       (${foldedRazao} like $1 || '%' escape '\\'
         or ${foldedFantasiaEst} like $1 || '%' escape '\\') desc,
       e.is_matriz desc,
       greatest(
         similarity(${foldedRazao}, $1),
         similarity(${foldedFantasiaEst}, $1)
       ) desc
     limit ${limitRef}`,
    params,
    COMPANY_NAME_SEARCH_TIMEOUT_MS,
  );
  return rows.map(mapCompanySearchHit);
}

async function searchCompaniesByName(
  queryText: string,
  ufs: string[],
  soMatriz: boolean,
  limit: number,
): Promise<CompanySearchHit[]> {
  const sources: Array<"flat" | "legacy"> = [];
  if (await hasEstablishmentsSearch()) sources.push("flat");
  sources.push("legacy");

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]!;
    const wave =
      source === "flat"
        ? searchCompaniesNameWaveFlat
        : searchCompaniesNameWaveLegacy;
    try {
      const prefix = await runCompanyNameWave(
        () => wave("prefix", queryText, ufs, soMatriz, limit),
        `searchCompanies.prefix.${source}`,
      );
      if (prefix.timedOut) return [];
      if (prefix.hits.length >= COMPANY_PREFIX_ENOUGH) return prefix.hits;

      const contain = await runCompanyNameWave(
        () => wave("tokens", queryText, ufs, soMatriz, limit),
        `searchCompanies.tokens.${source}`,
      );
      if (contain.timedOut) return prefix.hits;
      return mergeCompanyNameWaves(prefix.hits, contain.hits, limit);
    } catch (err) {
      const canFallback =
        i < sources.length - 1 && isMissingOrUnpopulatedRelationError(err);
      if (canFallback) continue;
      throw err;
    }
  }
  return [];
}

export const supabaseRepo: GridRepo = {
  async getProfile(userId: string) {
    const { rows } = await query("select * from profiles where id = $1", [userId]);
    if (rows[0]) return mapProfile(rows[0]);
    const inserted = await query(
      `insert into profiles (id, nome, plano, creditos)
       values ($1, $2, 'free', 25)
       returning *`,
      [userId, userId === LOCAL_USER_ID ? "Rômulo Freitas" : null],
    );
    return mapProfile(inserted.rows[0]);
  },

  async listPresets() {
    return loadPresets();
  },

  async listNiches() {
    const presets = await loadPresets();
    return presets.filter((p) => !p.parent_id);
  },

  async listSegments(nicheId?: string) {
    const presets = await loadPresets();
    return presets.filter((p) =>
      nicheId ? p.parent_id === nicheId : !!p.parent_id,
    );
  },

  async getPreset(id) {
    const presets = await loadPresets();
    return presets.find((p) => p.id === id);
  },

  async listPresetCnaes(presetId) {
    return loadPresetCnaes(presetId);
  },

  async resolveCnaesForPreset(presetId) {
    const preset = await this.getPreset(presetId);
    if (!preset) return [];
    const [curated, refCnaes] = await Promise.all([
      loadPresetCnaes(presetId),
      loadRefCnaes(),
    ]);
    return resolvePresetCnaes(preset, curated, refCnaes);
  },

  async previewCnaes(filters) {
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
    const allowed = await resolveAllowedCnaes(probe);
    if (!allowed || allowed.has("__none__")) return [];
    const codes = [...allowed].filter((c) => c !== "__none__");
    const selected = new Set(filters.cnaes ?? []);
    const [{ rows: refs }, countMap] = await Promise.all([
      query<{ codigo: string; descricao: string }>(
        "select codigo, descricao from ref_cnae where codigo = any($1::text[])",
        [codes],
      ),
      countCnaesByCode(codes, filters.ufs ?? []),
    ]);
    const refMap = new Map(refs.map((r) => [trimChar(r.codigo), r.descricao]));
    return codes
      .map((codigo) => ({
        codigo,
        descricao: refMap.get(codigo) ?? "NÃO ENCONTRADO",
        count: countMap.get(codigo) ?? 0,
        selected: selected.size ? selected.has(codigo) : false,
      }))
      .sort((a, b) => b.count - a.count);
  },

  async searchCnaes(q, limit = 30) {
    const queryText = q.trim();
    if (queryText.length < 1) return [];
    const tokens = queryTokens(queryText);
    const seed = tokens[0] ?? queryText;
    const pattern = `%${seed}%`;
    const fetchLimit = Math.max(limit * 4, 80);
    const mvSql = `select c.codigo, c.descricao, coalesce(x.n, 0)::int as n
         from ref_cnae c
         left join (
           select cnae_principal, sum(n)::int as n
           from cnae_uf_count
           group by 1
         ) x on x.cnae_principal = c.codigo
         where c.codigo ilike $1 or c.descricao ilike $1
         order by n desc, c.descricao
         limit $2`;
    const scanSql = (table: "establishments_search" | "establishments") =>
      `with hits as (
           select codigo, descricao
           from ref_cnae
           where codigo ilike $1 or descricao ilike $1
           limit 200
         )
         select h.codigo, h.descricao, coalesce(x.n, 0)::int as n
         from hits h
         left join (
           select e.cnae_principal, count(*)::int as n
           from ${table} e
           where e.cnae_principal in (select codigo from hits)
           group by 1
         ) x on x.cnae_principal = h.codigo
         order by n desc, h.descricao
         limit $2`;
    const attempts: Array<{ sql: string; heavy: boolean; kind: "mv" | "flat" | "est" }> = [
      { sql: mvSql, heavy: false, kind: "mv" },
      { sql: scanSql("establishments_search"), heavy: true, kind: "flat" },
      { sql: scanSql("establishments"), heavy: true, kind: "est" },
    ];

    let lastErr: unknown;
    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i]!;
      if (attempt.kind === "mv" && !(await hasCnaeUfCount())) continue;
      if (attempt.kind === "flat" && !(await hasEstablishmentsSearch())) continue;
      try {
        const run = attempt.heavy ? querySearch : query;
        const { rows } = await run<{ codigo: string; descricao: string; n: number }>(
          attempt.sql,
          [pattern, fetchLimit],
        );
        return rows
          .map((r) => ({
            codigo: trimChar(r.codigo),
            descricao: r.descricao,
            count: Number(r.n),
          }))
          .filter((r) => cnaeMatchesQuery(r.codigo, r.descricao, queryText))
          .slice(0, limit);
      } catch (err) {
        lastErr = err;
        const canFallback =
          i < attempts.length - 1 &&
          (isMissingOrUnpopulatedRelationError(err) || isStatementTimeoutError(err));
        if (canFallback) continue;
        throw err;
      }
    }
    if (lastErr) throw lastErr;
    return [];
  },

  async searchCompanies(q, opts) {
    const queryText = q.trim();
    if (!canSearchCompanies(queryText)) return [];
    const limit = opts?.limit ?? COMPANY_SEARCH_LIMIT;
    const ufs = opts?.ufs ?? [];
    const soMatriz = Boolean(opts?.soMatriz);
    const started = Date.now();
    let hits: CompanySearchHit[];
    try {
      if (isCompanyCnpjQuery(queryText)) {
        hits = await searchCompaniesByCnpj(queryText, ufs, soMatriz, limit);
      } else {
        hits = await searchCompaniesByName(queryText, ufs, soMatriz, limit);
      }
    } catch (err) {
      if (isStatementTimeoutError(err)) {
        logSearchDuration("searchCompanies", started, { n: 0, timeout: true });
        return [];
      }
      throw err;
    }
    const withDecisor = await attachDecisorsToCompanyHits(hits);
    logSearchDuration("searchCompanies", started, { n: withDecisor.length });
    return withDecisor;
  },

  async listMunicipios(ufs, q = "") {
    const all = await loadRefMunicipios();
    const ufSet = new Set(ufs.map((u) => u.trim().toUpperCase()));
    let list = ufSet.size ? all.filter((m) => ufSet.has(m.uf)) : all;
    const needle = q.trim();
    if (needle.length >= 1) {
      const nq = normalizeText(needle);
      list = list.filter((m) => normalizeText(m.nome).includes(nq));
    }
    list = [...list].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const cap = municipioListLimit(ufs.length);
    if (cap != null) list = list.slice(0, cap);
    return list;
  },

  async listCapitals(ufs) {
    const target = ufs.length ? ufs : Object.keys(CAPITALS);
    const { rows } = await query(
      "select id, nome, uf from ref_municipio where uf = any($1::text[])",
      [target],
    );
    const all = rows.map((m) => ({
      id: Number(m.id),
      nome: String(m.nome),
      uf: trimChar(m.uf),
    }));
    return target
      .map((uf) => {
        const name = CAPITALS[uf];
        return all.find(
          (m) => m.uf === uf && normalizeText(m.nome) === normalizeText(name ?? ""),
        );
      })
      .filter((m): m is RefMunicipio => !!m);
  },

  async countByPresetInRegion(presetId, ufs) {
    const map = await countPresetsInRegion([presetId], ufs);
    return map[presetId] ?? 0;
  },

  async countPresetsInRegion(presetIds, ufs) {
    return countPresetsInRegion(presetIds, ufs);
  },

  async count(filters: SearchFilters, mode: CountMode = "full") {
    const allowed = await resolveAllowedCnaes(filters);
    return countCached(filters, mode, allowed);
  },

  async hasCachedSearchCandidates(filters) {
    const allowed = await resolveAllowedCnaes(filters);
    const cached = await getCountCache(countCacheKey(filters, "full", allowed));
    return cachedCandidateCnpjs(cached, CANDIDATE_CAP) != null;
  },

  async recordDoneSearchJob(userId, nome, filters, searchId) {
    const { rows } = await query(
      `insert into search_jobs (user_id, nome, filtros, status, search_id, finished_at)
       values ($1, $2, $3::jsonb, 'done', $4, now())
       returning *`,
      [userId, nome, JSON.stringify(filters), searchId],
    );
    return mapSearchJob(rows[0]);
  },

  async runSearch(userId, nome, filters) {
    const allowed = await resolveAllowedCnaes(filters);
    const profile = await scoreProfileForFilters(filters);
    const useFlat = await hasEstablishmentsSearch();
    let rows: Record<string, unknown>[];
    const started = Date.now();
    const cachedCnpjs = useFlat
      ? cachedCandidateCnpjs(
          await getCountCache(countCacheKey(filters, "full", allowed)),
          CANDIDATE_CAP,
        )
      : null;
    if (cachedCnpjs) {
      const result = await querySearch(flatEstablishmentsByCnpjsSql(), [
        cnpjChar14Params(cachedCnpjs),
      ]);
      rows = result.rows;
      logSearchDuration("runSearch.candidates", started, {
        flat: true,
        cache: true,
        n: rows.length,
      });
    } else if (useFlat) {
      const { sql, params } = buildFlatFilterSql(filters, allowed);
      const joinSql = buildFlatMatchFrom(filters);
      const limitParam = params.length + 1;
      const result = await querySearch(
        flatRankedEstablishmentsSql(sql, joinSql, limitParam),
        [...params, CANDIDATE_CAP],
      );
      rows = result.rows;
      logSearchDuration("runSearch.candidates", started, {
        flat: true,
        n: rows.length,
      });
    } else {
      const { sql, params } = buildFilterSql(filters, allowed);
      const fromSql = buildMatchFrom(filters);
      const limitParam = params.length + 1;
      const result = await querySearch(
        `select e.* ${fromSql}
         where ${sql}
         order by e.cnpj
         limit $${limitParam}`,
        [...params, CANDIDATE_CAP],
      );
      rows = result.rows;
      logSearchDuration("runSearch.candidates", started, {
        flat: false,
        n: rows.length,
      });
    }
    const hydrateStarted = Date.now();
    const ests = rows.map(mapEstablishment);
    const packed = await fetchByCnpjs(
      ests.map((e) => e.cnpj),
      ests,
    );
    const quals = packed.quals;
    const meta = await phoneMeta(
      ests.flatMap((e) => [
        { ddd: e.ddd1, tel: e.telefone1 },
        { ddd: e.ddd2, tel: e.telefone2 },
      ]),
    );
    logSearchDuration("runSearch.hydrate", hydrateStarted, { n: ests.length });
    const scored = ests
      .map((est) => {
        const company = packed.companies.get(est.cnpj_basico);
        if (!company) return null;
        const partners = packed.partners.get(est.cnpj_basico) ?? [];
        const contacts = buildContacts(
          est.cnpj,
          est.ddd1,
          est.telefone1,
          est.ddd2,
          est.telefone2,
          meta,
        );
        const enrichment = packed.enrichment.get(est.cnpj) ?? null;
        const { score, decisorNome } = scoreRow(
          est,
          company,
          partners,
          quals,
          contacts,
          isEnrichmentFresh(enrichment) ? enrichment : null,
          filters,
          profile,
          allowed,
        );
        const primary = contacts[0];
        const snapshot: GridRowSnapshot = {
          razaoSocial: company.razao_social,
          nomeFantasia: est.nome_fantasia,
          municipio: packed.mun.get(est.municipio_id)?.nome ?? "NÃO ENCONTRADO",
          uf: est.uf,
          cnaeCodigo: est.cnae_principal,
          cnaeDescricao:
            packed.cnae.get(est.cnae_principal)?.descricao ?? "NÃO ENCONTRADO",
          telefone: primary ? `${primary.ddd}${primary.telefone}` : null,
          seal: primary?.seal ?? "NAO_CONFIRMADO",
          sharedCount: primary?.sharedCount ?? 0,
          sharedVerdict: primary?.sharedVerdict,
          decisorNome,
          porte: company.porte,
          email: est.email?.trim() || null,
        };
        return { est, score, snapshot };
      })
      .filter(
        (x): x is { est: Establishment; score: number; snapshot: GridRowSnapshot } =>
          !!x,
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, RESULT_CAP);

    await this.pruneUnsavedSearches(userId, { incoming: 1 });
    const inserted = await query(
      `insert into searches (user_id, nome, filtros, total_found, saved)
       values ($1, $2, $3::jsonb, $4, false)
       returning *`,
      [userId, nome, JSON.stringify(filters), scored.length],
    );
    const search = mapSearch(inserted.rows[0]);
    if (scored.length) {
      const values: string[] = [];
      const leadParams: unknown[] = [];
      scored.forEach((row, idx) => {
        const base = leadParams.length;
        values.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, 'novo', $${base + 6}::jsonb)`,
        );
        leadParams.push(
          search.id,
          userId,
          row.est.cnpj,
          row.score,
          idx + 1,
          JSON.stringify({ gridSnapshot: row.snapshot }),
        );
      });
      await query(
        `insert into saved_leads (search_id, user_id, cnpj, grid_score, grid_position, status, enrichment)
         values ${values.join(",")}`,
        leadParams,
      );
    }
    return search;
  },

  async enqueueSearchJob(userId, nome, filters) {
    const { rows } = await query(
      `insert into search_jobs (user_id, nome, filtros, status)
       values ($1, $2, $3::jsonb, 'pending')
       returning *`,
      [userId, nome, JSON.stringify(filters)],
    );
    return mapSearchJob(rows[0]);
  },

  async findReusableSearchJob(userId, filters) {
    const { rows } = await query(
      `select * from search_jobs
       where user_id = $1
         and filtros = $2::jsonb
         and (
           (
             status in ('pending', 'running')
             and created_at > now() - ($3::int * interval '1 minute')
           )
           or (
             status = 'done'
             and search_id is not null
             and finished_at > now() - ($4::int * interval '1 minute')
           )
         )
       order by
         case when status in ('pending', 'running') then 0 else 1 end,
         created_at desc
       limit 1`,
      [
        userId,
        JSON.stringify(filters),
        SEARCH_JOB_LIVE_REUSE_MINUTES,
        SEARCH_JOB_DONE_REUSE_MINUTES,
      ],
    );
    return rows[0] ? mapSearchJob(rows[0]) : null;
  },

  async getSearchJob(id, userId) {
    const { rows } = await query(
      `select * from search_jobs where id = $1 and user_id = $2`,
      [id, userId],
    );
    return rows[0] ? mapSearchJob(rows[0]) : null;
  },

  async countSearchJobsAhead(job) {
    if (job.status !== "pending") return 0;
    const { rows } = await query<{ n: number }>(
      `select count(*)::int as n from search_jobs
       where status = 'pending' and created_at < $1`,
      [job.created_at],
    );
    return Number(rows[0]?.n ?? 0);
  },

  async claimSearchJob() {
    const { rows } = await query(
      `update search_jobs
       set status = 'running', locked_at = now(), attempts = attempts + 1
       where id = (
         select id from search_jobs
         where status = 'pending'
            or (status = 'running' and locked_at < now() - interval '10 minutes')
         order by created_at
         limit 1
         for update skip locked
       )
       returning *`,
    );
    return rows[0] ? mapSearchJob(rows[0]) : null;
  },

  async claimOwnedSearchJob(id, userId) {
    const { rows } = await query(
      `update search_jobs
       set status = 'running', locked_at = now(), attempts = attempts + 1
       where id = $1
         and user_id = $2
         and (
           status = 'pending'
           or (
             status = 'running'
             and locked_at < now() - ($3::int * interval '1 second')
           )
         )
       returning *`,
      [id, userId, SEARCH_JOB_STALE_RUNNING_SECONDS],
    );
    return rows[0] ? mapSearchJob(rows[0]) : null;
  },

  async finishSearchJob(id, patch) {
    await query(
      `update search_jobs
       set status = $2,
           search_id = coalesce($3, search_id),
           error = $4,
           finished_at = now()
       where id = $1`,
      [id, patch.status, patch.search_id ?? null, patch.error ?? null],
    );
  },

  async getSearch(searchId) {
    const { rows } = await query("select * from searches where id = $1", [searchId]);
    return rows[0] ? mapSearch(rows[0]) : undefined;
  },

  async listSearches(userId, opts) {
    try {
      const params: unknown[] = [userId];
      let limitSql = "";
      if (opts?.limit != null) {
        params.push(opts.limit);
        limitSql = ` limit $${params.length}`;
      }
      const { rows } = await query(
        `select * from searches where user_id = $1 and saved = true order by created_at desc${limitSql}`,
        params,
      );
      return rows.map(mapSearch);
    } catch (err) {
      if (isUndefinedTableError(err)) return [];
      throw err;
    }
  },

  async listRecentSearches(userId, opts) {
    try {
      const params: unknown[] = [userId];
      let where = "user_id = $1";
      if (opts?.saved != null) {
        params.push(opts.saved);
        where += ` and saved = $${params.length}`;
      }
      let limitSql = "";
      if (opts?.limit != null) {
        params.push(opts.limit);
        limitSql = ` limit $${params.length}`;
      }
      const { rows } = await query(
        `select * from searches where ${where} order by created_at desc${limitSql}`,
        params,
      );
      return rows.map(mapSearch);
    } catch (err) {
      if (isUndefinedTableError(err)) return [];
      throw err;
    }
  },

  async saveSearch(searchId, patch) {
    const current = await this.getSearch(searchId);
    if (!current) return undefined;
    const nome = patch.nome != null && patch.nome.trim() ? patch.nome.trim() : current.nome;
    const saved = patch.saved != null ? patch.saved : current.saved;
    const { rows } = await query(
      "update searches set nome = $2, saved = $3 where id = $1 returning *",
      [searchId, nome, saved],
    );
    const search = rows[0] ? mapSearch(rows[0]) : undefined;
    if (search && patch.saved === false) {
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

  async deleteSearch(searchId) {
    const { rowCount } = await query("delete from searches where id = $1", [searchId]);
    return (rowCount ?? 0) > 0;
  },

  async deleteSavedLead(searchId, cnpj) {
    const padded = digitsCnpj(cnpj);
    const { rowCount } = await query(
      "delete from saved_leads where search_id = $1 and cnpj = $2::char(14)",
      [searchId, padded],
    );
    if (!(rowCount ?? 0)) return false;
    await query(
      `with ranked as (
         select id, row_number() over (order by grid_position, created_at) as pos
         from saved_leads where search_id = $1
       )
       update saved_leads sl set grid_position = ranked.pos
         from ranked where sl.id = ranked.id`,
      [searchId],
    );
    await query(
      `update searches set total_found = (
         select count(*)::int from saved_leads where search_id = $1
       ) where id = $1`,
      [searchId],
    );
    return true;
  },

  async createSavedCnpjSearch(userId, cnpj, nome) {
    const padded = digitsCnpj(cnpj);
    const hits = await this.searchCompanies(padded, { limit: 1 });
    const hit = hits[0];
    if (!hit) return null;
    const [presets, curated, refCnaes] = await Promise.all([
      this.listPresets(),
      loadAllPresetCnaes(),
      this.listRefCnaes(),
    ]);
    const preset = matchPresetForCnae(
      hit.cnaeCodigo,
      presets,
      curated,
      refCnaes,
    );
    const filters: SearchFilters = {
      ...DEFAULT_FILTERS,
      cnpjs: [padded],
      ufs: hit.uf ? [hit.uf] : [],
      segmentIds: preset ? [preset.id] : [],
      intentQuery: preset ? null : hit.cnaeDescricao || null,
    };
    const snapshot: GridRowSnapshot = {
      razaoSocial: hit.razaoSocial,
      nomeFantasia: hit.nomeFantasia,
      municipio: hit.municipio,
      uf: hit.uf,
      cnaeCodigo: hit.cnaeCodigo,
      cnaeDescricao: hit.cnaeDescricao,
      telefone: hit.telefone,
      seal: "NAO_CONFIRMADO",
      sharedCount: 0,
      decisorNome: hit.decisorNome ?? null,
      porte: null,
      email: null,
    };
    const inserted = await query(
      `insert into searches (user_id, nome, filtros, total_found, saved)
       values ($1, $2, $3::jsonb, 1, true)
       returning *`,
      [
        userId,
        nome?.trim() || displayCompanyName(hit.nomeFantasia, hit.razaoSocial),
        JSON.stringify(filters),
      ],
    );
    const search = mapSearch(inserted.rows[0]);
    await query(
      `insert into saved_leads (search_id, user_id, cnpj, grid_score, grid_position, status, enrichment)
       values ($1, $2, $3::char(14), 0, 1, 'novo', $4::jsonb)`,
      [search.id, userId, padded, JSON.stringify({ gridSnapshot: snapshot })],
    );
    return search;
  },

  async listCompanyBriefs(cnpjs) {
    const padded = [...new Set(cnpjs.map(digitsCnpj))].filter(Boolean);
    if (!padded.length) return [];
    const { rows } = await querySearch<{
      cnpj: string;
      razao_social: string;
      nome_fantasia: string | null;
      ddd1: string | null;
      telefone1: string | null;
    }>(
      `select e.cnpj, c.razao_social, e.nome_fantasia, e.ddd1, e.telefone1
         from establishments e
         join companies c on c.cnpj_basico = e.cnpj_basico
        where e.cnpj = any($1::char(14)[])`,
      [padded],
    );
    const hits: CompanySearchHit[] = rows.map((r) => ({
      cnpj: trimChar(r.cnpj),
      razaoSocial: r.razao_social,
      nomeFantasia: r.nome_fantasia,
      municipio: "",
      uf: "",
      cnaeCodigo: null,
      cnaeDescricao: "",
      telefone:
        r.ddd1 && r.telefone1 ? `${r.ddd1}${r.telefone1}` : null,
      decisorNome: null,
    }));
    const withDecisor = await attachDecisorsToCompanyHits(hits);
    const dddByCnpj = new Map(
      rows.map((r) => [trimChar(r.cnpj), r] as const),
    );
    return withDecisor.map((hit) => {
      const raw = dddByCnpj.get(hit.cnpj);
      return {
        cnpj: hit.cnpj,
        razaoSocial: hit.razaoSocial,
        nomeFantasia: hit.nomeFantasia,
        ddd1: raw?.ddd1 ?? null,
        telefone1: raw?.telefone1 ?? null,
        decisorNome: hit.decisorNome ?? null,
      } satisfies CompanyBrief;
    });
  },

  async listGridRows(searchId, cursor = 0, limit = 50) {
    const search = await this.getSearch(searchId);
    if (!search) return { rows: [], nextCursor: null, total: 0, unaudited: 0 };
    const [totalRes, pageRes] = await Promise.all([
      query<{ n: number }>(
        "select count(*)::int as n from saved_leads where search_id = $1",
        [searchId],
      ),
      query(
        `select cnpj, grid_score, grid_position, enrichment
         from saved_leads
         where search_id = $1
         order by grid_position
         limit $2 offset $3`,
        [searchId, limit, cursor],
      ),
    ]);
    const total = Number(totalRes.rows[0]?.n ?? 0);
    const page = pageRes.rows;
    const nextCursor = cursor + limit < total ? cursor + limit : null;

    const parsed = page.map((lead) => {
      const cnpj = trimChar(lead.cnpj);
      const gridScore = Number(lead.grid_score ?? 0);
      const gridPosition = Number(lead.grid_position ?? 0);
      return {
        cnpj,
        gridScore,
        gridPosition,
        snap: parseGridSnapshot(lead.enrichment),
      };
    });
    const missing = parsed.filter((p) => !p.snap).map((p) => p.cnpj);
    const leadByCnpj = new Map(
      parsed.map((p) => [
        p.cnpj,
        { gridScore: p.gridScore, gridPosition: p.gridPosition },
      ]),
    );

    const [unaudited, rfRows] = await Promise.all([
      countUnaudited(searchId, search.user_id, total),
      missing.length
        ? rowsFromReceita(missing, leadByCnpj).catch(
            () => new Map<string, GridRow>(),
          )
        : Promise.resolve(new Map<string, GridRow>()),
    ]);

    let rows: GridRow[] = parsed.map((p) => {
      if (p.snap) return gridRowFromSnapshot(p.cnpj, p.snap, p);
      return rfRows.get(p.cnpj) ?? gridRowStub(p.cnpj, p);
    });

    try {
      rows = await overlayGridRows(searchId, search.user_id, rows);
    } catch {
      /* snapshots / RF rows still render */
    }

    return { rows, nextCursor, total, unaudited };
  },

  async listUnauditedCnpjs(searchId, opts) {
    const search = await this.getSearch(searchId);
    if (!search) return [];
    const limit =
      opts?.limit != null && Number.isFinite(opts.limit) && opts.limit > 0
        ? Math.floor(opts.limit)
        : null;
    const params: unknown[] = [searchId, search.user_id];
    const limitSql = limit != null ? ` limit $${params.push(limit)}` : "";
    const { rows } = await query<{ cnpj: string }>(
      `select sl.cnpj
       from saved_leads sl
       where sl.search_id = $1
         and not exists (
           select 1 from billed_cnpjs b
            where b.profile_id = $2
              and b.kind = 'enrich'
              and b.cnpj = sl.cnpj
         )
         and not exists (
           select 1 from enrichment_jobs j
            where j.search_id = sl.search_id
              and j.cnpj = sl.cnpj
              and j.status in ('done', 'skipped')
         )
       order by sl.grid_position${limitSql}`,
      params,
    );
    return rows.map((r) => trimChar(r.cnpj));
  },

  async getDossier(cnpj, searchId) {
    return dossierOf(cnpj, searchId);
  },

  async updateLead(savedLeadId, patch) {
    const sets: string[] = [];
    const params: unknown[] = [savedLeadId];
    if (patch.status) {
      params.push(patch.status);
      sets.push(`status = $${params.length}`);
    }
    if (patch.notas !== undefined) {
      params.push(patch.notas);
      sets.push(`notas = $${params.length}`);
    }
    if (!sets.length) return;
    const { rows } = await query(
      `update saved_leads set ${sets.join(", ")} where id = $1 returning *`,
      params,
    );
    const lead = rows[0];
    if (lead && patch.status === "ligando") {
      await this.recordCallEvent(String(lead.user_id), {
        cnpj: trimChar(lead.cnpj),
        savedLeadId: String(lead.id),
        source: "status",
      });
    }
  },

  async updateProfile(userId, patch) {
    const current = await this.getProfile(userId);
    const next = { ...current, ...patch };
    const { rows } = await query(
      `update profiles set
         nome = $2, plano = $3, creditos = $4, especialidade = $5,
         area = $6, empresa_usuario = $7, cidade_usuario = $8,
         documento = $9, documento_tipo = $10,
         foto_url = $11, como_chama = $12, tratamento = $13, promessa = $14,
         duracao_reuniao = $15, meta_ligacoes_dia = $16,
         onboarding_completed_at = $17
       where id = $1
       returning *`,
      [
        userId,
        next.nome,
        next.plano,
        next.creditos,
        next.especialidade,
        next.area,
        next.empresa_usuario,
        next.cidade_usuario,
        next.documento,
        next.documento_tipo,
        next.foto_url,
        next.como_chama,
        next.tratamento,
        next.promessa,
        next.duracao_reuniao,
        next.meta_ligacoes_dia,
        next.onboarding_completed_at,
      ],
    );
    return mapProfile(rows[0]);
  },

  async recordCallEvent(userId, input) {
    const { rows } = await query(
      `insert into call_events (user_id, cnpj, saved_lead_id, source)
       values ($1, $2, $3, $4)
       on conflict (user_id, cnpj, day_sp) do nothing
       returning id`,
      [userId, input.cnpj, input.savedLeadId ?? null, input.source],
    );
    return Boolean(rows[0]);
  },

  async findNextCallLead(userId, searchId?: string | null): Promise<NextCallLead | null> {
    const params: unknown[] = [userId];
    let preferred = "";
    if (searchId) {
      params.push(searchId);
      preferred = `order by (s.id = $2) desc, s.created_at desc`;
    } else {
      preferred = "order by s.created_at desc";
    }
    const { rows } = await query(
      `with chosen as (
         select s.id
         from searches s
         where s.user_id = $1
           and s.saved = true
           and exists (
             select 1 from saved_leads sl
             where sl.search_id = s.id and sl.status = 'novo'
           )
         ${preferred}
         limit 1
       )
       select sl.cnpj, sl.search_id, sl.grid_position,
              coalesce(nullif(e.nome_fantasia, ''), c.razao_social, sl.cnpj) as nome
       from saved_leads sl
       join chosen ch on ch.id = sl.search_id
       left join establishments e on e.cnpj = sl.cnpj
       left join companies c on c.cnpj_basico = e.cnpj_basico
       where sl.status = 'novo'
       order by sl.grid_position
       limit 1`,
      params,
    );
    const row = rows[0];
    if (!row) return null;
    return {
      cnpj: trimChar(row.cnpj),
      searchId: String(row.search_id),
      nome: String(row.nome ?? row.cnpj),
      gridPosition: Number(row.grid_position ?? 0),
    };
  },

  async getPilotStats(userId, opts) {
    const profile = await this.getProfile(userId);
    const includeNext = opts?.includeNext !== false;
    try {
      const { rows } = await query(
        `select created_at from call_events where user_id = $1`,
        [userId],
      );
      const stamps = rows.map((r) => isoStr(r.created_at));
      const today = saoPauloDay(new Date());
      let proximaFicha = null;
      if (includeNext) {
        try {
          proximaFicha = await this.findNextCallLead(userId);
        } catch (err) {
          console.error("pilot_stats_next_lead_error", err);
        }
      }
      return {
        hoje: stamps.filter((iso) => saoPauloDay(iso) === today).length,
        meta: profile.meta_ligacoes_dia || DEFAULT_CALL_GOAL,
        sequencia: callStreak(stamps),
        proximaFicha,
      };
    } catch (err) {
      if (isUndefinedTableError(err)) {
        return {
          hoje: 0,
          meta: profile.meta_ligacoes_dia || DEFAULT_CALL_GOAL,
          sequencia: 0,
          proximaFicha: null,
        };
      }
      throw err;
    }
  },

  async saveNicheCuradoria(presetId, rows) {
    await query("delete from niche_preset_cnaes where preset_id = $1", [presetId]);
    if (rows.length) {
      const values: string[] = [];
      const params: unknown[] = [];
      for (const row of rows) {
        const b = params.length;
        values.push(`($${b + 1}, $${b + 2}, $${b + 3})`);
        params.push(presetId, row.cnae, row.incluido);
      }
      await query(
        `insert into niche_preset_cnaes (preset_id, cnae, incluido) values ${values.join(",")}`,
        params,
      );
    }
    await query("update niche_presets set curado = true where id = $1", [presetId]);
    invalidatePresetCache();
  },

  async listRefCnaes() {
    return loadRefCnaes();
  },

  async getAllLeadsForExport(searchId) {
    const { rows } = await query(
      "select cnpj from saved_leads where search_id = $1 order by grid_position",
      [searchId],
    );
    const out: LeadDossier[] = [];
    for (const r of rows) {
      const d = await dossierOf(trimChar(r.cnpj), searchId);
      if (d) out.push(d);
    }
    return out;
  },

  async addOptOut(documento, motivo) {
    const digits = documento.replace(/\D/g, "");
    await query(
      `insert into opt_outs (documento, motivo) values ($1, $2)
       on conflict (documento) do update set motivo = excluded.motivo`,
      [digits, motivo],
    );
  },

  async isOptedOut(cnpj) {
    const digits = cnpj.replace(/\D/g, "");
    const { rows } = await query<{ n: number }>(
      `select count(*)::int as n from opt_outs
       where documento = $1
          or documento = left($1, 8)
          or $1 like documento || '%'`,
      [digits],
    );
    return Number(rows[0]?.n ?? 0) > 0;
  },

  async classifyEnrichmentCnpjs(cnpjs, userId) {
    const unique = [...new Set(cnpjs.map((c) => c.replace(/\D/g, "")))].filter(
      Boolean,
    );
    if (!unique.length) return { chargeable: [], skippedOptOut: 0 };

    const { rows: opted } = await query<{ cnpj: string }>(
      `select distinct e.cnpj
       from unnest($1::text[]) as e(cnpj)
       join opt_outs o on
         o.documento = e.cnpj
         or o.documento = left(e.cnpj, 8)
         or e.cnpj like o.documento || '%'`,
      [unique],
    );
    const optedSet = new Set(opted.map((r) => r.cnpj.replace(/\D/g, "")));
    const remaining = unique.filter((c) => !optedSet.has(c));
    if (!remaining.length) {
      return { chargeable: [], skippedOptOut: optedSet.size };
    }

    if (userId) {
      const [{ rows: billed }, { rows: active }] = await Promise.all([
        query<{ cnpj: string }>(
          `select cnpj from billed_cnpjs
            where profile_id = $1 and kind = 'enrich' and cnpj = any($2::text[])`,
          [userId, remaining],
        ).catch(() => ({ rows: [] as Array<{ cnpj: string }> })),
        query<{ cnpj: string }>(
          `select distinct cnpj from enrichment_jobs
            where requested_by = $1
              and cnpj = any($2::text[])
              and status in ('pending', 'running')`,
          [userId, remaining],
        ),
      ]);
      const billedSet = new Set(billed.map((r) => trimChar(r.cnpj)));
      const activeSet = new Set(active.map((r) => trimChar(r.cnpj)));
      const chargeable = remaining.filter(
        (c) => !billedSet.has(c) && !activeSet.has(c),
      );
      return { chargeable, skippedOptOut: optedSet.size };
    }

    const { rows: fresh } = await query<{ cnpj: string }>(
      `select cnpj from lead_enrichment
       where cnpj = any($1::text[])
         and expires_at > now()
         and coalesce(stage, 'complete') = 'complete'`,
      [remaining],
    );
    const freshSet = new Set(fresh.map((r) => trimChar(r.cnpj)));

    const afterFresh = remaining.filter((c) => !freshSet.has(c));
    if (!afterFresh.length) {
      return { chargeable: [], skippedOptOut: optedSet.size };
    }

    const { rows: active } = await query<{ cnpj: string }>(
      `select distinct cnpj from enrichment_jobs
       where cnpj = any($1::text[])
         and status in ('pending', 'running')`,
      [afterFresh],
    );
    const activeSet = new Set(active.map((r) => trimChar(r.cnpj)));
    const chargeable = afterFresh.filter((c) => !activeSet.has(c));
    return { chargeable, skippedOptOut: optedSet.size };
  },

  async getLatestEnrichmentJob(cnpj) {
    const { rows } = await query(
      `select * from enrichment_jobs
       where cnpj = $1
       order by created_at desc
       limit 1`,
      [cnpj],
    );
    return rows[0] ? mapJob(rows[0]) : null;
  },

  async enqueueEnrichment(input) {
    const unique = [...new Set(input.cnpjs)];
    if (!unique.length) return { queued: 0, skippedOptOut: 0 };

    const { rows: opted } = await query<{ cnpj: string }>(
      `select distinct e.cnpj
       from unnest($1::text[]) as e(cnpj)
       join opt_outs o on
         o.documento = e.cnpj
         or o.documento = left(e.cnpj, 8)
         or e.cnpj like o.documento || '%'`,
      [unique],
    );
    const optedSet = new Set(opted.map((r) => r.cnpj));
    const remaining = unique.filter((c) => !optedSet.has(c));
    if (!remaining.length) {
      return { queued: 0, skippedOptOut: optedSet.size };
    }

    const { rows: fresh } = await query<{ cnpj: string }>(
      `select cnpj from lead_enrichment
       where cnpj = any($1::text[])
         and expires_at > now()
         and coalesce(stage, 'complete') = 'complete'`,
      [remaining],
    );
    const freshSet = new Set(fresh.map((r) => trimChar(r.cnpj)));

    const { rows: active } = await query<{ cnpj: string }>(
      `select distinct cnpj from enrichment_jobs
       where cnpj = any($1::text[])
         and status in ('pending', 'running')`,
      [remaining],
    );
    const activeSet = new Set(active.map((r) => trimChar(r.cnpj)));

    const pending = remaining.filter(
      (c) => (input.force || !freshSet.has(c)) && !activeSet.has(c),
    );
    const skippedFresh = input.force
      ? []
      : remaining.filter((c) => freshSet.has(c) && !activeSet.has(c));

    const priority = input.priority ? 1 : 0;
    if (pending.length) {
      await query(
        `insert into enrichment_jobs
           (cnpj, requested_by, search_id, status, attempts, finished_at, payload, priority)
         select x.cnpj, $2, $3, 'pending', 0, null, $4::jsonb, $5
         from unnest($1::text[]) as x(cnpj)`,
        [
          pending,
          input.userId,
          input.searchId,
          input.payload ? JSON.stringify(input.payload) : null,
          priority,
        ],
      );
    }
    if (skippedFresh.length) {
      await query(
        `insert into enrichment_jobs
           (cnpj, requested_by, search_id, status, attempts, finished_at, priority)
         select x.cnpj, $2, $3, 'skipped', 0, now(), $4
         from unnest($1::text[]) as x(cnpj)`,
        [skippedFresh, input.userId, input.searchId, priority],
      );
    }
    return { queued: pending.length, skippedOptOut: optedSet.size };
  },

  async listEnrichmentJobs(searchId) {
    const { rows } = await query(
      `select distinct on (cnpj) *
         from enrichment_jobs
        where search_id = $1
        order by cnpj, created_at desc, id desc`,
      [searchId],
    );
    return rows.map(mapJob);
  },

  async getEnrichment(cnpj) {
    const { rows } = await query("select * from lead_enrichment where cnpj = $1", [
      cnpj,
    ]);
    return rows[0] ? mapEnrichment(rows[0]) : null;
  },

  async upsertEnrichment(row) {
    await query(
      `insert into lead_enrichment (
         cnpj, domain, domain_status, http_status, phones, emails, whatsapp,
         socials, tech, freshness, osm, gmb, discarded_domains, dor_digital,
         contexto, fonte, people, stage, collected_at, expires_at
       ) values (
         $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::jsonb,$9::jsonb,$10::jsonb,
         $11::jsonb,$12::jsonb,$13,$14,$15,$16::jsonb,$17::jsonb,$18,$19,$20
       )
       on conflict (cnpj) do update set
         domain = excluded.domain,
         domain_status = excluded.domain_status,
         http_status = excluded.http_status,
         phones = excluded.phones,
         emails = excluded.emails,
         whatsapp = excluded.whatsapp,
         socials = excluded.socials,
         tech = excluded.tech,
         freshness = excluded.freshness,
         osm = excluded.osm,
         gmb = excluded.gmb,
         discarded_domains = excluded.discarded_domains,
         dor_digital = excluded.dor_digital,
         contexto = excluded.contexto,
         fonte = excluded.fonte,
         people = excluded.people,
         stage = excluded.stage,
         collected_at = excluded.collected_at,
         expires_at = excluded.expires_at`,
      [
        row.cnpj,
        row.domain,
        row.domain_status,
        row.http_status,
        JSON.stringify(row.phones),
        JSON.stringify(row.emails),
        row.whatsapp,
        JSON.stringify(row.socials),
        JSON.stringify(row.tech),
        JSON.stringify(row.freshness),
        row.osm ? JSON.stringify(row.osm) : null,
        row.gmb ? JSON.stringify(row.gmb) : null,
        row.discarded_domains ?? [],
        row.dor_digital,
        row.contexto,
        JSON.stringify(row.fonte),
        row.people == null ? null : JSON.stringify(row.people),
        row.stage ?? "complete",
        row.collected_at,
        row.expires_at,
      ],
    );
  },

  async updateJob(id, patch) {
    const sets: string[] = [];
    const params: unknown[] = [id];
    for (const [key, value] of Object.entries(patch)) {
      params.push(value);
      sets.push(`${key} = $${params.length}`);
    }
    if (!sets.length) return;
    await query(`update enrichment_jobs set ${sets.join(", ")} where id = $1`, params);
  },

  async claimEnrichmentJob() {
    const { rows } = await query(
      `update enrichment_jobs
       set status = 'running', locked_at = now(), attempts = attempts + 1
       where id = (
         select id from enrichment_jobs
         where status = 'pending'
            or (status = 'running' and locked_at < now() - interval '10 minutes')
         order by priority desc, created_at, id
         limit 1
         for update skip locked
       )
       returning *`,
    );
    return rows[0] ? mapJob(rows[0]) : null;
  },

  async findFreshEnrichment(cnpj) {
    const row = await this.getEnrichment(cnpj);
    return isEnrichmentFresh(row) ? row : null;
  },

  async hasActiveEnrichmentJob(cnpj) {
    const { rows } = await query(
      `select id from enrichment_jobs
       where cnpj = $1 and status in ('pending', 'running')
       limit 1`,
      [cnpj],
    );
    return rows.length > 0;
  },

  async getDomainCache(cnpjBasico) {
    const { rows } = await query(
      "select domain, status from domain_cache where cnpj_basico = $1",
      [cnpjBasico],
    );
    if (!rows[0]) return null;
    return {
      domain: rows[0].domain == null ? null : String(rows[0].domain),
      status: String(rows[0].status),
    };
  },

  async setDomainCache(cnpjBasico, domain, status) {
    await query(
      `insert into domain_cache (cnpj_basico, domain, status, resolved_at)
       values ($1, $2, $3, now())
       on conflict (cnpj_basico) do update set
         domain = excluded.domain,
         status = excluded.status,
         resolved_at = now()`,
      [cnpjBasico, domain, status],
    );
  },

  async listIntegrationConnections(userId) {
    try {
      const { rows } = await query(
        `select * from integration_connections where user_id = $1 order by created_at desc`,
        [userId],
      );
      return rows.map(mapIntegrationConnection);
    } catch (err) {
      if (isUndefinedTableError(err)) return [];
      throw err;
    }
  },

  async getIntegrationConnection(id) {
    const { rows } = await query(
      `select * from integration_connections where id = $1`,
      [id],
    );
    return rows[0] ? mapIntegrationConnection(rows[0]) : null;
  },

  async createIntegrationConnection(row) {
    const { rows } = await query(
      `insert into integration_connections (
         id, user_id, provider, kind, display_name, status,
         credentials_ciphertext, credentials_nonce, oauth_expires_at,
         caller_id, config, created_at, updated_at
       ) values (
         $1, $2, $3, $4, $5, $6,
         decode($7, 'base64'), decode($8, 'base64'), $9,
         $10, $11::jsonb, $12, $13
       ) returning *`,
      [
        row.id,
        row.user_id,
        row.provider,
        row.kind,
        row.display_name,
        row.status,
        row.credentials_ciphertext,
        row.credentials_nonce,
        row.oauth_expires_at,
        row.caller_id,
        JSON.stringify(row.config),
        row.created_at,
        row.updated_at,
      ],
    );
    return mapIntegrationConnection(rows[0]!);
  },

  async updateIntegrationConnection(id, userId, patch) {
    const current = await this.getIntegrationConnection(id);
    if (!current || current.user_id !== userId) return null;
    const next = { ...current, ...patch, updated_at: new Date().toISOString() };
    const { rows } = await query(
      `update integration_connections set
         display_name = $3,
         status = $4,
         caller_id = $5,
         config = $6::jsonb,
         credentials_ciphertext = decode($7, 'base64'),
         credentials_nonce = decode($8, 'base64'),
         updated_at = $9
       where id = $1 and user_id = $2
       returning *`,
      [
        id,
        userId,
        next.display_name,
        next.status,
        next.caller_id,
        JSON.stringify(next.config),
        next.credentials_ciphertext,
        next.credentials_nonce,
        next.updated_at,
      ],
    );
    return rows[0] ? mapIntegrationConnection(rows[0]) : null;
  },

  async deleteIntegrationConnection(id, userId) {
    const { rowCount } = await query(
      `delete from integration_connections where id = $1 and user_id = $2`,
      [id, userId],
    );
    return (rowCount ?? 0) > 0;
  },

  async createIntegrationJob(row) {
    const { rows } = await query(
      `insert into integration_jobs (
         user_id, connection_id, search_id, verb, provider, status, payload
       ) values ($1, $2, $3, $4, $5, $6, $7::jsonb)
       returning *`,
      [
        row.user_id,
        row.connection_id,
        row.search_id,
        row.verb,
        row.provider,
        row.status ?? "pending",
        JSON.stringify(row.payload ?? {}),
      ],
    );
    return mapIntegrationJob(rows[0]!);
  },

  async listIntegrationJobs(userId, searchId) {
    const { rows } = searchId
      ? await query(
          `select * from integration_jobs
           where user_id = $1 and search_id = $2
           order by created_at desc`,
          [userId, searchId],
        )
      : await query(
          `select * from integration_jobs
           where user_id = $1
           order by created_at desc
           limit 50`,
          [userId],
        );
    return rows.map(mapIntegrationJob);
  },

  async claimIntegrationJob() {
    const { rows } = await query(
      `update integration_jobs
       set status = 'running', locked_at = now(), attempts = attempts + 1
       where id = (
         select id from integration_jobs
         where status = 'pending'
            or (status = 'running' and locked_at < now() - interval '10 minutes')
         order by created_at
         limit 1
         for update skip locked
       )
       returning *`,
    );
    return rows[0] ? mapIntegrationJob(rows[0]) : null;
  },

  async updateIntegrationJob(id, patch) {
    const sets: string[] = [];
    const params: unknown[] = [id];
    for (const [key, value] of Object.entries(patch)) {
      params.push(key === "result" ? JSON.stringify(value) : value);
      sets.push(
        key === "result"
          ? `result = $${params.length}::jsonb`
          : `${key} = $${params.length}`,
      );
    }
    if (!sets.length) return;
    await query(
      `update integration_jobs set ${sets.join(", ")} where id = $1`,
      params,
    );
  },

  async insertIntegrationEvent(row) {
    await query(
      `insert into integration_events (
         user_id, connection_id, job_id, direction, event_type,
         cnpj, e164, external_id, disposition, lead_status, payload_summary
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
      [
        row.user_id,
        row.connection_id,
        row.job_id,
        row.direction,
        row.event_type,
        row.cnpj,
        row.e164,
        row.external_id,
        row.disposition,
        row.lead_status,
        JSON.stringify(row.payload_summary),
      ],
    );
  },

  async findSavedLeadForOutcome(userId, input) {
    if (input.searchId && input.cnpj) {
      const { rows } = await query(
        `select id, cnpj, search_id from saved_leads
         where user_id = $1 and search_id = $2 and cnpj = $3
         limit 1`,
        [userId, input.searchId, input.cnpj],
      );
      if (rows[0]) {
        return {
          id: String(rows[0].id),
          cnpj: String(rows[0].cnpj).trim(),
          search_id: String(rows[0].search_id),
        };
      }
    }
    if (input.cnpj) {
      const { rows } = await query(
        `select id, cnpj, search_id from saved_leads
         where user_id = $1 and cnpj = $2
         order by created_at desc
         limit 1`,
        [userId, input.cnpj],
      );
      if (rows[0]) {
        return {
          id: String(rows[0].id),
          cnpj: String(rows[0].cnpj).trim(),
          search_id: String(rows[0].search_id),
        };
      }
    }
    if (input.e164) {
      const digits = input.e164.replace(/^\+55/, "").replace(/\D/g, "");
      const ddd = digits.slice(0, 2);
      const tel = digits.slice(2);
      const { rows } = await query(
        `select sl.id, sl.cnpj, sl.search_id
         from saved_leads sl
         join establishments e on e.cnpj = sl.cnpj
         where sl.user_id = $1
           and (
             (e.ddd1 = $2 and e.telefone1 = $3)
             or (e.ddd2 = $2 and e.telefone2 = $3)
           )
         order by sl.created_at desc
         limit 1`,
        [userId, ddd, tel],
      );
      if (rows[0]) {
        return {
          id: String(rows[0].id),
          cnpj: String(rows[0].cnpj).trim(),
          search_id: String(rows[0].search_id),
        };
      }
    }
    return null;
  },

  ...crmPgMethods,
  ...catchupPgMethods,
};
