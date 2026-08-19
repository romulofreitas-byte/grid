export type ScoreProfile = "b2c_local" | "b2b_industria";

export type ContactSeal =
  | "CONFIRMADO"
  | "ATUALIZADO"
  | "COMPARTILHADO"
  | "GRUPO"
  | "NAO_CONFIRMADO";

export type SharedPhoneVerdict = "contabilidade" | "grupo_economico" | "proprio";

export type PhoneSource =
  | "receita"
  | "site_tel"
  | "site_schema"
  | "site_texto"
  | "site_whatsapp"
  | "osm";

export type PhoneEvidence = {
  e164: string;
  display: string;
  tipo: "fixo" | "movel" | "especial";
  sources: PhoneSource[];
  isWhatsApp: boolean;
  sharedCount?: number;
  sharedVerdict?: SharedPhoneVerdict;
  seal: ContactSeal;
};

export type DomainStatus = "confirmado" | "nao_confirmado" | "nao_encontrado";

export type EnrichmentStage = "domain" | "home" | "site" | "complete";

export type DigitalSignalId =
  | "sem-site"
  | "site-fora"
  | "sem-mensuracao"
  | "copyright-antigo"
  | "sem-instagram"
  | "sem-whatsapp"
  | "midia-paga";

export type MarketBrief = {
  slug: string;
  nome: string;
  dorPrincipal: string;
  dorChip: string;
  perguntaConsideracao: string;
  sazonalidade: string | null;
  sazonalidadeChip: string | null;
  sazonalidadeMeses: number[];
  sazonalidadeAtiva: boolean;
  janelaHorario: string;
  janelaChip: string;
  cidade: string;
};

export type EnrichmentJobStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "skipped";

export type TechSignals = {
  metaPixel: boolean;
  gtm: boolean;
  ga4: boolean;
  googleAds: boolean;
  tiktokPixel: boolean;
  rdStation: boolean;
  hotjar: boolean;
  clarity: boolean;
  chat: string | null;
  plataforma: string | null;
  https: boolean;
  viewport: boolean;
};

export type SitePersonPapel = "vendas" | "financeiro" | "diretoria" | "outro";

export type SitePerson = {
  nome: string;
  cargo: string;
  papel: SitePersonPapel;
  portaRecomendada: boolean;
  fonte: "schema" | "pagina";
};

export type LeadEnrichment = {
  cnpj: string;
  domain: string | null;
  domain_status: DomainStatus;
  http_status: number | null;
  phones: PhoneEvidence[];
  emails: Array<{ valor: string; fonte: string; coletado_em: string }>;
  whatsapp: string | null;
  socials: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    youtube?: string;
  };
  tech: TechSignals;
  freshness: {
    copyrightYear?: number;
    latestPost?: string;
  };
  osm: { matched: boolean; attribution?: string } | null;
  dor_digital: number;
  contexto: string[];
  fonte: Record<string, { fonte: string; coletado_em: string }>;
  midiaPaga: {
    label: string;
    verificado_automaticamente: false;
  };
  /** null/omit = not extracted yet (legacy row). [] = crawled, none found. */
  people?: SitePerson[] | null;
  /** omit/legacy = complete. Partial stages stream to the ficha only. */
  stage?: EnrichmentStage;
  collected_at: string;
  expires_at: string;
};

export type EnrichmentJob = {
  id: number;
  cnpj: string;
  requested_by: string | null;
  search_id: string | null;
  status: EnrichmentJobStatus;
  attempts: number;
  last_error: string | null;
  locked_at: string | null;
  created_at: string;
  finished_at: string | null;
};

export type LeadStatus = "novo" | "ligando" | "reuniao" | "descartado";

export type Provenance<T> = {
  valor: T;
  fonte: string;
  coletado_em: string;
};

export type Company = {
  cnpj_basico: string;
  razao_social: string;
  natureza_id: number | null;
  qualificacao_responsavel: number | null;
  capital_social: number | null;
  porte: string | null;
};

export type Establishment = {
  cnpj: string;
  cnpj_basico: string;
  is_matriz: boolean;
  nome_fantasia: string | null;
  situacao: string;
  data_situacao: string | null;
  data_inicio: string | null;
  cnae_principal: string;
  cnae_secundarios: string[];
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  uf: string;
  municipio_id: number;
  ddd1: string | null;
  telefone1: string | null;
  ddd2: string | null;
  telefone2: string | null;
  email: string | null;
};

export type Partner = {
  id: number;
  cnpj_basico: string;
  nome: string;
  qualificacao_id: number;
  data_entrada: string | null;
  faixa_etaria: number | null;
};

export type PartnerKind = "pessoa" | "holding" | "gestao" | "empresa";

export type PartnerCard = {
  nome: string;
  qualificacao: string;
  dataEntrada: string | null;
  faixaEtaria: number | null;
  kind: PartnerKind;
  kindLabel: string | null;
};

export type RefCnae = { codigo: string; descricao: string };
export type RefMunicipio = { id: number; nome: string; uf: string };
export type RefQualificacao = { id: number; descricao: string };

export type NichePreset = {
  id: string;
  slug: string;
  nome: string;
  grupo: "b2c_local" | "b2b_industria";
  perfil_score: ScoreProfile;
  /** null = nicho raiz; preenchido = segmento filho */
  parent_id: string | null;
  keywords: string[];
  exclusoes: string[];
  /** stems used to generate coherent mock company names */
  name_stems: string[];
  curado: boolean;
  ordem: number;
};

export type NichePresetCnae = {
  preset_id: string;
  cnae: string;
  incluido: boolean;
};

export type Tratamento = "o" | "a" | "e";

export type CallEventSource = "status" | "dialer" | "manual";

export type Profile = {
  id: string;
  nome: string | null;
  plano: string;
  creditos: number;
  especialidade: string | null;
  area: string | null;
  empresa_usuario: string | null;
  cidade_usuario: string | null;
  documento: string | null;
  documento_tipo: "cpf" | "cnpj" | null;
  foto_url: string | null;
  como_chama: string | null;
  tratamento: Tratamento | null;
  promessa: string | null;
  duracao_reuniao: number;
  meta_ligacoes_dia: number;
  onboarding_completed_at: string | null;
  created_at: string;
};

export type CallEvent = {
  id: string;
  user_id: string;
  cnpj: string;
  saved_lead_id: string | null;
  source: CallEventSource;
  created_at: string;
};

export type NextCallLead = {
  cnpj: string;
  searchId: string;
  nome: string;
  gridPosition: number;
};

export type PilotStats = {
  hoje: number;
  meta: number;
  sequencia: number;
  proximaFicha: NextCallLead | null;
};

export type SearchFilters = {
  cnaes: string[];
  /** @deprecated prefer segmentIds; kept for compat */
  presetId: string | null;
  /** IDs de segmentos (presets com parent_id) */
  segmentIds: string[];
  /** Busca livre por intenção (ex.: "indústria química") */
  intentQuery: string | null;
  /** CNPJs escolhidos na busca de empresas */
  cnpjs: string[];
  ufs: string[];
  municipioIds: number[];
  portes: string[];
  capitalMin: number | null;
  capitalMax: number | null;
  idadeMinimaAnos: number;
  soMatriz: boolean;
  excluirSimples: boolean;
  exigirEmailProprio: boolean;
  exigirDecisor: boolean;
  ocultarTelefonesCompartilhados: boolean;
  ocultarEmailsGratuitos: boolean;
  ocultarEnderecosCompartilhados: boolean;
  /** Fase 2: only companies with fresh lead_enrichment */
  soEnriquecidas: boolean;
};

export type Search = {
  id: string;
  user_id: string;
  nome: string;
  filtros: SearchFilters;
  total_found: number;
  created_at: string;
  saved: boolean;
};

export type SavedLead = {
  id: string;
  search_id: string;
  user_id: string;
  cnpj: string;
  grid_score: number;
  grid_position: number;
  enrichment: Record<string, unknown> | null;
  status: LeadStatus;
  notas: string | null;
  created_at: string;
};

export type PhoneUsage = {
  ddd1: string;
  telefone1: string;
  qtd_empresas: number;
};

export type EmailUsage = {
  email: string;
  qtd_empresas: number;
};

export type AddressUsage = {
  cep: string;
  logradouro: string;
  numero: string;
  qtd_empresas: number;
};

export type ContactInfo = {
  ddd: string | null;
  telefone: string | null;
  seal: ContactSeal;
  sharedCount: number;
  sharedVerdict?: SharedPhoneVerdict;
  label: string;
  source: "receita" | "site";
  sideNote?: string;
};

export type DecisorInfo = {
  nome: string;
  qualificacao: string;
  dataEntrada: string | null;
  faixaEtaria: number | null;
} | null;

export type LeadDossier = {
  establishment: Establishment;
  company: Company;
  cnaeDescricao: string;
  municipioNome: string;
  contacts: ContactInfo[];
  emailSeal: {
    email: string | null;
    shared: boolean;
    free: boolean;
    accountantHint: boolean;
  };
  addressSharedCount: number;
  decisor: DecisorInfo;
  socios: PartnerCard[];
  gridScore: number;
  gridPosition: number | null;
  status: LeadStatus;
  notas: string | null;
  savedLeadId: string | null;
  enrichment: LeadEnrichment | null;
  enrichmentJobStatus: EnrichmentJobStatus | null;
  market: MarketBrief;
  goldenMinute: {
    contexto: string;
    facts: Array<{ phrase: string; fonte: string; id?: DigitalSignalId }>;
    insufficient: boolean;
  };
};

export type GridRow = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  municipio: string;
  uf: string;
  cnaeCodigo: string | null;
  cnaeDescricao: string;
  telefone: string | null;
  seal: ContactSeal;
  sharedCount: number;
  decisorNome: string | null;
  porte: string | null;
  gridScore: number;
  gridPosition: number;
  sharedVerdict?: SharedPhoneVerdict;
  enrichmentStatus: EnrichmentJobStatus | null;
  hasAudit: boolean;
};

export type CompanySearchHit = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  municipio: string;
  uf: string;
  cnaeCodigo: string | null;
  cnaeDescricao: string;
  telefone: string | null;
  /** Decisor do QSA (pickDecisor) — exibido no card, não é busca por sócio. */
  decisorNome?: string | null;
};

export type GridRowSnapshot = {
  razaoSocial: string;
  nomeFantasia: string | null;
  municipio: string;
  uf: string;
  cnaeCodigo: string | null;
  cnaeDescricao: string;
  telefone: string | null;
  seal: ContactSeal;
  sharedCount: number;
  sharedVerdict?: SharedPhoneVerdict;
  decisorNome: string | null;
  porte: string | null;
};

export type CountMode = "total" | "full";

export type CountResult = {
  total: number;
  capped: boolean;
  comTelefone: number;
  comEmail: number;
  comDecisor: number;
  porMunicipio: Array<{
    municipio_id: number;
    nome: string;
    uf: string;
    total: number;
  }>;
};

export const DEFAULT_FILTERS: SearchFilters = {
  cnaes: [],
  presetId: null,
  segmentIds: [],
  intentQuery: null,
  cnpjs: [],
  ufs: [],
  municipioIds: [],
  portes: [],
  capitalMin: null,
  capitalMax: null,
  idadeMinimaAnos: 0,
  soMatriz: false,
  excluirSimples: false,
  exigirEmailProprio: false,
  exigirDecisor: false,
  ocultarTelefonesCompartilhados: true,
  ocultarEmailsGratuitos: false,
  ocultarEnderecosCompartilhados: false,
  soEnriquecidas: false,
};
