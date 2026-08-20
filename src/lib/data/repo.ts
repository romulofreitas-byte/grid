import type {
  IntegrationConnectionRecord,
  IntegrationEventRecord,
  IntegrationJobRecord,
  SavedLeadRef,
} from "@/lib/integrations/records";
import type { CompanySearchOpts } from "@/lib/data/company-search";
import type {
  CallEventSource,
  CompanySearchHit,
  CountMode,
  CountResult,
  EnrichmentJob,
  GridRow,
  LeadDossier,
  LeadEnrichment,
  LeadStatus,
  NextCallLead,
  NichePreset,
  NichePresetCnae,
  PilotStats,
  Profile,
  RefCnae,
  RefMunicipio,
  Search,
  SearchFilters,
} from "@/lib/types";

export type GridRepo = {
  getProfile(userId: string): Promise<Profile>;
  listPresets(): Promise<NichePreset[]>;
  listNiches(): Promise<NichePreset[]>;
  listSegments(nicheId?: string): Promise<NichePreset[]>;
  getPreset(id: string): Promise<NichePreset | undefined>;
  listPresetCnaes(presetId: string): Promise<NichePresetCnae[]>;
  resolveCnaesForPreset(presetId: string): Promise<string[]>;
  previewCnaes(filters: {
    segmentIds: string[];
    intentQuery: string | null;
    cnaes: string[];
    ufs: string[];
  }): Promise<Array<RefCnae & { count: number; selected: boolean }>>;
  searchCnaes(
    query: string,
    limit?: number,
  ): Promise<Array<RefCnae & { count: number }>>;
  searchCompanies(
    query: string,
    opts?: CompanySearchOpts,
  ): Promise<CompanySearchHit[]>;
  listMunicipios(ufs: string[], query?: string): Promise<RefMunicipio[]>;
  listCapitals(ufs: string[]): Promise<RefMunicipio[]>;
  countByPresetInRegion(presetId: string, ufs: string[]): Promise<number>;
  countPresetsInRegion(
    presetIds: string[],
    ufs: string[],
  ): Promise<Record<string, number>>;
  count(filters: SearchFilters, mode?: CountMode): Promise<CountResult>;
  runSearch(
    userId: string,
    nome: string,
    filters: SearchFilters,
  ): Promise<Search>;
  getSearch(searchId: string): Promise<Search | undefined>;
  listSearches(userId: string, opts?: { limit?: number }): Promise<Search[]>;
  listRecentSearches(userId: string, opts?: { limit?: number }): Promise<Search[]>;
  saveSearch(
    searchId: string,
    patch: { nome?: string; saved?: boolean },
  ): Promise<Search | undefined>;
  deleteSearch(searchId: string): Promise<boolean>;
  listGridRows(
    searchId: string,
    cursor?: number,
    limit?: number,
  ): Promise<{ rows: GridRow[]; nextCursor: number | null; total: number; unaudited: number }>;
  listUnauditedCnpjs(searchId: string): Promise<string[]>;
  getDossier(cnpj: string, searchId?: string): Promise<LeadDossier | null>;
  updateLead(
    savedLeadId: string,
    patch: { status?: LeadStatus; notas?: string },
  ): Promise<void>;
  updateProfile(userId: string, patch: Partial<Profile>): Promise<Profile>;
  recordCallEvent(
    userId: string,
    input: {
      cnpj: string;
      savedLeadId?: string | null;
      source: CallEventSource;
    },
  ): Promise<boolean>;
  getPilotStats(userId: string): Promise<PilotStats>;
  findNextCallLead(userId: string): Promise<NextCallLead | null>;
  saveNicheCuradoria(
    presetId: string,
    rows: Array<{ cnae: string; incluido: boolean }>,
  ): Promise<void>;
  listRefCnaes(): Promise<RefCnae[]>;
  getAllLeadsForExport(searchId: string): Promise<LeadDossier[]>;
  addOptOut(documento: string, motivo: string | null): Promise<void>;
  isOptedOut(cnpj: string): Promise<boolean>;
  enqueueEnrichment(input: {
    cnpjs: string[];
    userId: string;
    searchId: string | null;
    priority?: boolean;
  }): Promise<{ queued: number; skippedOptOut: number }>;
  listEnrichmentJobs(searchId: string): Promise<EnrichmentJob[]>;
  getEnrichment(cnpj: string): Promise<LeadEnrichment | null>;
  upsertEnrichment(row: LeadEnrichment): Promise<void>;
  updateJob(
    id: number,
    patch: Partial<
      Pick<EnrichmentJob, "status" | "attempts" | "last_error" | "locked_at" | "finished_at">
    >,
  ): Promise<void>;
  claimEnrichmentJob(): Promise<EnrichmentJob | null>;
  findFreshEnrichment(cnpj: string): Promise<LeadEnrichment | null>;
  hasActiveEnrichmentJob(cnpj: string): Promise<boolean>;
  classifyEnrichmentCnpjs(cnpjs: string[]): Promise<{
    chargeable: string[];
    skippedOptOut: number;
  }>;
  getLatestEnrichmentJob(cnpj: string): Promise<EnrichmentJob | null>;
  getDomainCache(
    cnpjBasico: string,
  ): Promise<{ domain: string | null; status: string } | null>;
  setDomainCache(
    cnpjBasico: string,
    domain: string | null,
    status: string,
  ): Promise<void>;
  listIntegrationConnections(userId: string): Promise<IntegrationConnectionRecord[]>;
  getIntegrationConnection(id: string): Promise<IntegrationConnectionRecord | null>;
  createIntegrationConnection(
    row: IntegrationConnectionRecord,
  ): Promise<IntegrationConnectionRecord>;
  updateIntegrationConnection(
    id: string,
    userId: string,
    patch: Partial<
      Pick<
        IntegrationConnectionRecord,
        | "display_name"
        | "status"
        | "caller_id"
        | "config"
        | "credentials_ciphertext"
        | "credentials_nonce"
      >
    >,
  ): Promise<IntegrationConnectionRecord | null>;
  deleteIntegrationConnection(id: string, userId: string): Promise<boolean>;
  createIntegrationJob(
    row: Omit<IntegrationJobRecord, "id" | "created_at" | "finished_at" | "locked_at" | "attempts" | "last_error" | "result" | "status"> & {
      status?: IntegrationJobRecord["status"];
    },
  ): Promise<IntegrationJobRecord>;
  listIntegrationJobs(
    userId: string,
    searchId?: string | null,
  ): Promise<IntegrationJobRecord[]>;
  claimIntegrationJob(): Promise<IntegrationJobRecord | null>;
  updateIntegrationJob(
    id: number,
    patch: Partial<
      Pick<
        IntegrationJobRecord,
        "status" | "attempts" | "last_error" | "locked_at" | "finished_at" | "result"
      >
    >,
  ): Promise<void>;
  insertIntegrationEvent(
    row: Omit<IntegrationEventRecord, "id" | "created_at">,
  ): Promise<void>;
  findSavedLeadForOutcome(
    userId: string,
    input: { cnpj?: string; e164?: string; searchId?: string | null },
  ): Promise<SavedLeadRef | null>;
};
