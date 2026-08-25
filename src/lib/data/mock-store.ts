import municipiosIbge from "@/data/ibge-municipios.json";
import { REF_CNAE } from "@/lib/data/cnae-catalog";
import { PRESET_SEED, resolveCnaesFromKeywords } from "@/lib/niches";
import { verdictFromPartnerOverlap } from "@/lib/contact-confidence";
import { seedCrmStore } from "@/lib/crm/mock-seed";
import type {
  CrmActivity,
  CrmDeal,
  CrmPipeline,
  CrmStage,
} from "@/lib/crm/types";
import type {
  AddressUsage,
  Company,
  EmailUsage,
  Establishment,
  NichePreset,
  NichePresetCnae,
  Partner,
  PhoneUsage,
  SharedPhoneVerdict,
  Profile,
  RefCnae,
  RefMunicipio,
  RefQualificacao,
  SavedLead,
  Search,
} from "@/lib/types";

export type SimplesNacional = {
  cnpj_basico: string;
  opcao_simples: boolean | null;
  opcao_mei: boolean | null;
};

export type OptOut = {
  id: string;
  documento: string;
  motivo: string | null;
  created_at: string;
};

export type MockStore = {
  ref_cnae: RefCnae[];
  ref_municipio: RefMunicipio[];
  ref_qualificacao: RefQualificacao[];
  companies: Company[];
  establishments: Establishment[];
  partners: Partner[];
  simples_nacional: SimplesNacional[];
  niche_presets: NichePreset[];
  niche_preset_cnaes: NichePresetCnae[];
  phone_usage: PhoneUsage[];
  phone_verdict: Array<{
    ddd1: string;
    telefone1: string;
    qtd_empresas: number;
    verdict: SharedPhoneVerdict;
  }>;
  email_usage: EmailUsage[];
  address_usage: AddressUsage[];
  lead_enrichment: import("@/lib/types").LeadEnrichment[];
  enrichment_jobs: import("@/lib/types").EnrichmentJob[];
  domain_cache: Array<{
    cnpj_basico: string;
    domain: string | null;
    status: string;
    resolved_at: string;
  }>;
  profiles: Profile[];
  searches: Search[];
  saved_leads: SavedLead[];
  opt_outs: OptOut[];
  call_events: import("@/lib/types").CallEvent[];
  integration_connections: import("@/lib/integrations/records").IntegrationConnectionRecord[];
  integration_jobs: import("@/lib/integrations/records").IntegrationJobRecord[];
  integration_events: import("@/lib/integrations/records").IntegrationEventRecord[];
  crm_pipelines: CrmPipeline[];
  crm_stages: CrmStage[];
  crm_deals: CrmDeal[];
  crm_activities: CrmActivity[];
};

const ACCOUNTANT_PHONE = "33334444";
const GROUP_PHONE = "32221111";
const GROUP_PARTNER = "Helena Vargas Silva";
const GROUP_RANGE = { from: 200, to: 208 } as const;
const SHARED_ACCOUNTANT_EMAIL = "contato@assessoriacontabilidade.com.br";
const SHARED_ADDRESS = {
  cep: "30130010",
  logradouro: "RUA DA BAHIA",
  numero: "1200",
  bairro: "CENTRO",
};

const REF_QUALIFICACAO: RefQualificacao[] = [
  { id: 49, descricao: "Sócio-Administrador" },
  { id: 50, descricao: "Administrador" },
  { id: 5, descricao: "Administrador" },
  { id: 10, descricao: "Diretor" },
  { id: 16, descricao: "Presidente" },
  { id: 22, descricao: "Sócio" },
  { id: 65, descricao: "Titular Pessoa Física" },
];

const QUAL_IDS = [49, 65, 50, 10, 16, 22, 5];
const PORTES = ["01", "03", "05"] as const;
const PARTNER_NAMES = [
  "Ana Paula Souza",
  "Carlos Eduardo Lima",
  "Fernanda Ribeiro",
  "João Pedro Alves",
  "Mariana Costa",
  "Ricardo Mendes",
  "Juliana Ferreira",
  "Paulo Henrique Dias",
  "Camila Nascimento",
  "Bruno Oliveira",
  "Patricia Gomes",
  "Felipe Martins",
  "Larissa Azevedo",
  "Diego Santana",
  "Beatriz Campos",
  "Gustavo Rocha",
  "Helena Duarte",
  "André Vasconcelos",
  "Sofia Carvalho",
  "Lucas Benedito",
  "Renata Pires",
  "Thiago Barbosa",
  "Isabela Freitas",
  "Marcelo Tavares",
  "Vanessa Lopes",
  "Rafael Siqueira",
  "Amanda Correia",
  "Eduardo Nogueira",
  "Priscila Ramos",
  "Leandro Teixeira",
  "Cristina Moura",
  "Rodrigo Farias",
  "Tatiane Almeida",
  "Vinícius Prado",
  "Eliane Cardoso",
  "Hugo Batista",
];

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

const CAPITAL_BY_UF: Record<string, string> = {
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

const DDD_BY_UF: Record<string, string[]> = {
  AC: ["68"],
  AL: ["82"],
  AP: ["96"],
  AM: ["92", "97"],
  BA: ["71", "73", "74", "75", "77"],
  CE: ["85", "88"],
  DF: ["61"],
  ES: ["27", "28"],
  GO: ["62", "64"],
  MA: ["98", "99"],
  MT: ["65", "66"],
  MS: ["67"],
  MG: ["31", "32", "33", "34", "35", "37", "38"],
  PA: ["91", "93", "94"],
  PB: ["83"],
  PR: ["41", "42", "43", "44", "45", "46"],
  PE: ["81", "87"],
  PI: ["86", "89"],
  RJ: ["21", "22", "24"],
  RN: ["84"],
  RS: ["51", "53", "54", "55"],
  RO: ["69"],
  RR: ["95"],
  SC: ["47", "48", "49"],
  SP: ["11", "12", "13", "14", "15", "16", "17", "18", "19"],
  SE: ["79"],
  TO: ["63"],
};

const EST_COUNT = 5000;

const REF_MUNICIPIO: RefMunicipio[] = municipiosIbge as RefMunicipio[];

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

function presetUuid(index: number): string {
  return `11111111-1111-4111-8111-${pad(index, 12)}`;
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function hashMix(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function makeCnpjBasico(i: number): string {
  return pad(10_000_000 + i, 8);
}

function makeCnpj(basico: string, filial = "0001"): string {
  const base = basico + filial;
  const weights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let j = 0; j < 12; j++) sum += Number(base[j]) * weights[j];
  const d1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  sum = 0;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const base13 = base + String(d1);
  for (let j = 0; j < 13; j++) sum += Number(base13[j]) * weights2[j];
  const d2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return base + String(d1) + String(d2);
}

function buildNichePresets(): NichePreset[] {
  const slugToId = new Map<string, string>();
  PRESET_SEED.forEach((seed, i) => {
    slugToId.set(seed.slug, presetUuid(i + 1));
  });

  return PRESET_SEED.map((seed) => ({
    id: slugToId.get(seed.slug)!,
    slug: seed.slug,
    nome: seed.nome,
    grupo: seed.grupo,
    perfil_score: seed.perfil_score,
    parent_id: seed.parent_slug ? slugToId.get(seed.parent_slug)! : null,
    keywords: seed.keywords,
    exclusoes: seed.exclusoes,
    name_stems: seed.name_stems,
    aliases: seed.aliases ?? [],
    curado: false,
    ordem: seed.ordem,
  }));
}

type SegmentPreset = NichePreset & { parent_id: string };

function buildMunicipioIndex(): {
  byUf: Map<string, RefMunicipio[]>;
  capitalIdByUf: Map<string, number>;
} {
  const byUf = new Map<string, RefMunicipio[]>();
  const capitalIdByUf = new Map<string, number>();

  for (const mun of REF_MUNICIPIO) {
    if (!byUf.has(mun.uf)) byUf.set(mun.uf, []);
    byUf.get(mun.uf)!.push(mun);

    const capitalName = CAPITAL_BY_UF[mun.uf];
    if (capitalName && mun.nome === capitalName) {
      capitalIdByUf.set(mun.uf, mun.id);
    }
  }

  return { byUf, capitalIdByUf };
}

function pickMunicipio(
  i: number,
  byUf: Map<string, RefMunicipio[]>,
  capitalIdByUf: Map<string, number>,
): RefMunicipio {
  const uf = UFS[i % UFS.length]!;
  const cities = byUf.get(uf) ?? REF_MUNICIPIO;
  const capitalId = capitalIdByUf.get(uf);
  const useCapital = hashMix(i + 17) % 100 < 40;

  if (useCapital && capitalId != null) {
    const capital = cities.find((c) => c.id === capitalId);
    if (capital) return capital;
  }

  const idx = hashMix(i * 31 + uf.charCodeAt(0)) % cities.length;
  return cities[idx]!;
}

function cityShortName(nome: string): string {
  const parts = nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 8);
  return parts
    .slice(0, 2)
    .map((p) => p.slice(0, 4))
    .join("");
}

function resolveSegmentCnaes(segment: SegmentPreset): RefCnae[] {
  let matched = resolveCnaesFromKeywords(
    segment.keywords,
    segment.exclusoes,
    [...REF_CNAE],
  );

  if (matched.length > 0) return matched;

  const words = segment.keywords
    .flatMap((k) => k.split(/\s+/))
    .map((w) => w.trim())
    .filter((w) => w.length >= 4);

  matched = REF_CNAE.filter((c) => {
    const desc = c.descricao
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();
    const excluded = segment.exclusoes.some((e) =>
      desc.includes(
        e.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase(),
      ),
    );
    if (excluded) return false;
    return words.some((w) =>
      desc.includes(w.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()),
    );
  });

  return matched.length > 0 ? matched : [REF_CNAE[0]!];
}

function pickDdd(uf: string, i: number): string {
  const ddds = DDD_BY_UF[uf] ?? ["11"];
  return ddds[hashMix(i + uf.charCodeAt(0)) % ddds.length]!;
}

function isGrupoLine(i: number): boolean {
  return i >= GROUP_RANGE.from && i < GROUP_RANGE.to;
}

function isAccountantLine(i: number): boolean {
  if (isGrupoLine(i)) return false;
  return hashMix(i + 101) % 7 === 0;
}

function makeTelefone(i: number, accountant: boolean): string {
  if (isGrupoLine(i)) return GROUP_PHONE;
  if (accountant) return ACCOUNTANT_PHONE;

  const mobile = hashMix(i + 3) % 3 !== 0;
  const seed = hashMix(i * 7919 + 104729);

  if (mobile) {
    const body = pad(seed % 10_000_000, 8);
    return `9${body}`.slice(0, 9);
  }

  const mid = pad(seed % 1000, 3);
  const tail = pad((seed >>> 10) % 10_000, 4);
  return `3${mid}${tail}`.slice(0, 8);
}

function pickStem(segment: SegmentPreset, i: number): string {
  const stems = segment.name_stems.length ? segment.name_stems : ["EMPRESA"];
  // Hash — never i % N alone (segment stride locks onto one stem)
  return stems[hashMix(i * 17 + segment.ordem * 13) % stems.length]!;
}

function pickPartnerName(i: number): string {
  if (isGrupoLine(i)) return GROUP_PARTNER;
  if (isAccountantLine(i)) return `Socio Contabil ${pad(i, 4)}`;
  return PARTNER_NAMES[hashMix(i * 97 + 41) % PARTNER_NAMES.length]!;
}

function pickEmail(i: number, stem: string): string | null {
  const bucket = hashMix(i * 13) % 11;
  if (bucket === 10) return null;
  if (bucket === 2 || bucket === 3) return SHARED_ACCOUNTANT_EMAIL;
  const domain = slugify(stem).replace(/[^a-z0-9]/g, "").slice(0, 18) || "empresa";
  if (bucket === 0) return `contato@${domain}.com.br`;
  if (bucket === 1) return `comercial@${domain}.com.br`;
  if (bucket === 4) return `atendimento@${domain}.com.br`;
  if (bucket === 5) return `vendas@${domain}.com.br`;
  if (bucket === 6) return `contato${hashMix(i) % 90}@gmail.com`;
  if (bucket === 7) return `comercial${hashMix(i + 3) % 90}@hotmail.com`;
  return `financeiro@${domain}.com.br`;
}

function buildReceitaData(
  segments: SegmentPreset[],
  byUf: Map<string, RefMunicipio[]>,
  capitalIdByUf: Map<string, number>,
) {
  const segmentCnaes = segments.map((seg) => resolveSegmentCnaes(seg));

  const companies: Company[] = [];
  const establishments: Establishment[] = [];
  const partners: Partner[] = [];
  const simples_nacional: SimplesNacional[] = [];
  let partnerId = 1;

  for (let i = 0; i < EST_COUNT; i++) {
    const segment = segments[i % segments.length]!;
    const cnaes = segmentCnaes[i % segments.length]!;
    const cnae = cnaes[i % cnaes.length]!;
    const mun = pickMunicipio(i, byUf, capitalIdByUf);
    const stem = pickStem(segment, i);
    const cityShort = cityShortName(mun.nome);
    const nn = pad((hashMix(i + segment.ordem) % 90) + 1, 2);
    const basico = makeCnpjBasico(i + 1);
    const accountant = isAccountantLine(i);
    const extraLine = !accountant && hashMix(i + 44) % 5 === 0;
    const sharedAddr = i >= 120 && i < 140;

    const formSuffix = ["LTDA", "EIRELI", "S/A"][hashMix(i + 5) % 3]!;
    const razao = `${stem} ${cityShort} ${nn} ${formSuffix}`;
    const fantasia =
      hashMix(i + 9) % 3 === 0
        ? `${stem}`
        : `${stem.split(" ")[0] ?? stem} ${cityShort}`;

    companies.push({
      cnpj_basico: basico,
      razao_social: razao,
      natureza_id: 2062,
      qualificacao_responsavel: QUAL_IDS[hashMix(i + 2) % QUAL_IDS.length]!,
      capital_social: 10_000 + (hashMix(i) % 50) * 25_000,
      porte: PORTES[hashMix(i + 7) % PORTES.length]!,
    });

    establishments.push({
      cnpj: makeCnpj(basico),
      cnpj_basico: basico,
      is_matriz: true,
      nome_fantasia: fantasia,
      situacao: "02",
      data_situacao: "2020-01-15",
      data_inicio: `${2005 + (hashMix(i) % 15)}-${pad((hashMix(i + 1) % 12) + 1, 2)}-01`,
      cnae_principal: cnae.codigo,
      cnae_secundarios:
        hashMix(i) % 4 === 0 && cnaes.length > 1
          ? [cnaes[hashMix(i + 1) % cnaes.length]!.codigo]
          : [],
      logradouro: sharedAddr
        ? SHARED_ADDRESS.logradouro
        : `RUA ${stem.split(" ")[0]}`,
      numero: sharedAddr ? SHARED_ADDRESS.numero : String(100 + (hashMix(i) % 900)),
      complemento: hashMix(i) % 7 === 0 ? "SALA 101" : null,
      bairro: sharedAddr ? SHARED_ADDRESS.bairro : cityShort,
      cep: sharedAddr
        ? SHARED_ADDRESS.cep
        : pad(10_000_000 + hashMix(i) % 89_999_999, 8),
      uf: mun.uf,
      municipio_id: mun.id,
      ddd1: isGrupoLine(i)
      ? "31"
      : accountant
        ? pickDdd(mun.uf, 0)
        : pickDdd(mun.uf, i),
      telefone1: makeTelefone(i, accountant),
      ddd2: extraLine ? pickDdd(mun.uf, i + 9) : null,
      telefone2: extraLine ? makeTelefone(i + 409, false) : null,
      email: pickEmail(i, stem),
    });

    partners.push({
      id: partnerId++,
      cnpj_basico: basico,
      nome: pickPartnerName(i),
      qualificacao_id: i === 0 ? 22 : QUAL_IDS[hashMix(i + 11) % QUAL_IDS.length]!,
      data_entrada: `${2010 + (hashMix(i) % 10)}-03-15`,
      faixa_etaria: (hashMix(i) % 5) + 3,
    });
    if (i === 0) {
      partners.push({
        id: partnerId++,
        cnpj_basico: basico,
        nome: "ALPHA HOLDING PARTICIPACOES LTDA",
        qualificacao_id: 49,
        data_entrada: "2012-01-10",
        faixa_etaria: 0,
      });
    }
    if (i === 1) {
      partners.push({
        id: partnerId++,
        cnpj_basico: basico,
        nome: "GAMA GESTAO EMPRESARIAL LTDA",
        qualificacao_id: 22,
        data_entrada: "2015-06-01",
        faixa_etaria: 0,
      });
    }

    simples_nacional.push({
      cnpj_basico: basico,
      opcao_simples: hashMix(i) % 9 !== 0,
      opcao_mei: hashMix(i) % 9 !== 0 && hashMix(i + 1) % 4 !== 0,
    });
  }

  return { companies, establishments, partners, simples_nacional };
}

export function rebuildUsageViews(store: MockStore): void {
  const phoneMap = new Map<string, Set<string>>();
  const emailMap = new Map<string, Set<string>>();
  const addrMap = new Map<string, Set<string>>();

  for (const e of store.establishments) {
    if (e.telefone1 && e.telefone1.length >= 8 && e.ddd1) {
      const key = `${e.ddd1}|${e.telefone1}`;
      if (!phoneMap.has(key)) phoneMap.set(key, new Set());
      phoneMap.get(key)!.add(e.cnpj_basico);
    }
    if (e.email?.includes("@")) {
      const key = e.email.toLowerCase();
      if (!emailMap.has(key)) emailMap.set(key, new Set());
      emailMap.get(key)!.add(e.cnpj_basico);
    }
    if (e.cep && e.logradouro && e.numero) {
      const key = `${e.cep}|${e.logradouro}|${e.numero}`;
      if (!addrMap.has(key)) addrMap.set(key, new Set());
      addrMap.get(key)!.add(e.cnpj_basico);
    }
  }

  store.phone_usage = [...phoneMap.entries()].map(([key, set]) => {
    const [ddd1, telefone1] = key.split("|");
    return { ddd1: ddd1!, telefone1: telefone1!, qtd_empresas: set.size };
  });
  store.email_usage = [...emailMap.entries()].map(([email, set]) => ({
    email,
    qtd_empresas: set.size,
  }));
  store.address_usage = [...addrMap.entries()].map(([key, set]) => {
    const [cep, logradouro, numero] = key.split("|");
    return { cep: cep!, logradouro: logradouro!, numero: numero!, qtd_empresas: set.size };
  });

  const partnersByBasico = new Map<string, string[]>();
  for (const p of store.partners) {
    const list = partnersByBasico.get(p.cnpj_basico) ?? [];
    list.push(p.nome);
    partnersByBasico.set(p.cnpj_basico, list);
  }

  store.phone_verdict = store.phone_usage.map((u) => {
    const key = `${u.ddd1}|${u.telefone1}`;
    const cnpjs = phoneMap.get(key) ?? new Set();
    const names = new Map<string, string[]>();
    for (const cnpj of cnpjs) {
      names.set(cnpj, partnersByBasico.get(cnpj) ?? []);
    }
    return {
      ddd1: u.ddd1,
      telefone1: u.telefone1,
      qtd_empresas: u.qtd_empresas,
      verdict: verdictFromPartnerOverlap(u.qtd_empresas, names),
    };
  });
}

function createMockStore(): MockStore {
  const niche_presets = buildNichePresets();
  const segments = niche_presets.filter(
    (p): p is SegmentPreset => p.parent_id !== null,
  );
  const { byUf, capitalIdByUf } = buildMunicipioIndex();
  const receita = buildReceitaData(segments, byUf, capitalIdByUf);

  const store: MockStore = {
    ref_cnae: [...REF_CNAE],
    ref_municipio: REF_MUNICIPIO,
    ref_qualificacao: REF_QUALIFICACAO,
    companies: receita.companies,
    establishments: receita.establishments,
    partners: receita.partners,
    simples_nacional: receita.simples_nacional,
    niche_presets,
    niche_preset_cnaes: [],
    phone_usage: [],
    phone_verdict: [],
    email_usage: [],
    address_usage: [],
    lead_enrichment: [],
    enrichment_jobs: [],
    domain_cache: [],
    profiles: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        nome: "Rômulo Freitas",
        plano: "free",
        creditos: 25,
        especialidade: "marketing digital",
        area: "vendas",
        empresa_usuario: "Combustível",
        cidade_usuario: "BH",
        documento: null,
        documento_tipo: null,
        foto_url: null,
        como_chama: "Rômulo",
        tratamento: "o",
        promessa: null,
        duracao_reuniao: 20,
        meta_ligacoes_dia: 20,
        onboarding_completed_at: "2026-01-01T12:00:00.000Z",
        created_at: "2026-01-01T12:00:00.000Z",
      },
    ],
    searches: [],
    saved_leads: [],
    opt_outs: [],
    call_events: [],
    integration_connections: [],
    integration_jobs: [],
    integration_events: [],
    crm_pipelines: [],
    crm_stages: [],
    crm_deals: [],
    crm_activities: [],
  };

  rebuildUsageViews(store);
  seedApproachDoorsEnrichment(store);
  seedCrmStore(store, Date.parse("2026-08-19T18:00:00.000Z"));
  return store;
}

function seedApproachDoorsEnrichment(store: MockStore): void {
  const est = store.establishments[0];
  if (!est) return;
  const collected = "2026-08-16T12:00:00.000Z";
  store.lead_enrichment.push({
    cnpj: est.cnpj,
    domain: "exemplo-holding.com.br",
    domain_status: "confirmado",
    http_status: 200,
    phones: [],
    emails: [],
    whatsapp: null,
    socials: { instagram: "https://instagram.com/exemplo" },
    tech: {
      metaPixel: false,
      gtm: false,
      ga4: false,
      googleAds: false,
      tiktokPixel: false,
      rdStation: false,
      hotjar: false,
      clarity: false,
      chat: null,
      plataforma: null,
      https: true,
      viewport: true,
    },
    freshness: { copyrightYear: 2026 },
    osm: null,
    dor_digital: 8,
    contexto: [
      "o site de vocês está no ar, mas não tem nenhuma ferramenta de mensuração instalada",
    ],
    fonte: {},
    midiaPaga: { label: "NÃO VERIFICADO", verificado_automaticamente: false },
    people: [
      {
        nome: "João Santos Lima",
        cargo: "Diretor Comercial",
        papel: "vendas",
        portaRecomendada: true,
        fonte: "schema",
      },
      {
        nome: "Ana Costa Ribeiro",
        cargo: "Diretora Financeira",
        papel: "financeiro",
        portaRecomendada: true,
        fonte: "pagina",
      },
    ],
    collected_at: collected,
    expires_at: "2026-09-15T12:00:00.000Z",
    stage: "complete",
  });
}

const MOCK_STORE_VERSION = 12;

const globalForMock = globalThis as typeof globalThis & {
  __gridMockStore?: MockStore;
  __gridMockStoreVersion?: number;
};

export function getMockStore(): MockStore {
  if (
    !globalForMock.__gridMockStore ||
    globalForMock.__gridMockStoreVersion !== MOCK_STORE_VERSION
  ) {
    globalForMock.__gridMockStore = createMockStore();
    globalForMock.__gridMockStoreVersion = MOCK_STORE_VERSION;
  }
  return globalForMock.__gridMockStore;
}

export const mockStore: MockStore = getMockStore();
