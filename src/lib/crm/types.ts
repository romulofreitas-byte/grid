import type { CrmStageKey, FichaMoveKey } from "@/lib/crm/cadence";

export const CRM_ACTIVITY_KINDS = [
  "ligar",
  "whatsapp",
  "email",
  "reuniao",
  "followup",
  "proposta",
  "nota",
] as const;

export type CrmActivityKind = (typeof CRM_ACTIVITY_KINDS)[number];

export const CRM_EVENT_KINDS = [...CRM_ACTIVITY_KINDS, "outcome"] as const;

export type CrmPerson = {
  name: string;
  phone: string;
  email: string;
};

export type CrmEventKind = (typeof CRM_EVENT_KINDS)[number];

export const CRM_OUTCOMES = ["open", "won", "lost"] as const;

export type CrmOutcome = (typeof CRM_OUTCOMES)[number];

export const CRM_ACTIVITY_STATUSES = ["open", "done"] as const;

export type CrmActivityStatus = (typeof CRM_ACTIVITY_STATUSES)[number];

export type ActivitySignal = "none" | "scheduled" | "today" | "overdue";

export type CrmPipeline = {
  id: string;
  user_id: string;
  nome: string;
  position: number;
  created_at: string;
};

export type CrmPipelineSummary = CrmPipeline & {
  deal_count: number;
};

export type CrmStage = {
  id: string;
  pipeline_id: string;
  nome: string;
  position: number;
  /** Stable role; null on custom faixas added by the piloto. */
  canonical_key: CrmStageKey | null;
  created_at: string;
};

export const CRM_DEAL_SOURCES = [
  "qualify_bridge",
  "catchup_bridge",
  "crm_add",
  "import",
  "inbound",
] as const;

export type CrmDealSource = (typeof CRM_DEAL_SOURCES)[number];

export const CRM_LEAD_KINDS = ["company", "person"] as const;
export type CrmLeadKind = (typeof CRM_LEAD_KINDS)[number];

export const CRM_FORM_CHANNELS = ["ads", "site"] as const;
export type CrmFormChannel = (typeof CRM_FORM_CHANNELS)[number];

export const AUTOMATION_LIMIT = 10;

export type CrmDealMeta = {
  searchId?: string;
  ufs?: string[];
  municipioIds?: number[];
  source?: CrmDealSource;
  lead_kind?: CrmLeadKind;
  form_answers?: Record<string, string>;
  form_channel?: CrmFormChannel;
};

export type CrmInboundEndpoint = {
  id: string;
  user_id: string;
  pipeline_id: string;
  stage_id: string | null;
  nome: string;
  lead_kind: CrmLeadKind;
  channel: CrmFormChannel;
  token_hash: string;
  created_at: string;
  updated_at: string;
};

export type CrmDeal = {
  id: string;
  pipeline_id: string;
  stage_id: string;
  company_name: string;
  contact_name: string;
  secretaries: string[];
  people: CrmPerson[];
  phones: string[];
  notes: string;
  /** Digits-only CNPJ when linked from search or a list; null for manual deals. */
  cnpj: string | null;
  meta: CrmDealMeta;
  outcome: CrmOutcome;
  /** Null until the piloto fills the deal value. */
  amount_cents: number | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type CrmEventMeta = {
  phone?: string;
  outcome?: CrmOutcome;
};

export type CrmEvent = {
  id: string;
  deal_id: string;
  kind: CrmEventKind;
  body: string;
  meta: CrmEventMeta;
  created_at: string;
  updated_at: string;
};

export type CrmNextAction = {
  kind: CrmActivityKind;
  dueAt: string;
};

export type CrmEventCreateInput = {
  kind: CrmEventKind;
  body?: string;
  meta?: CrmEventMeta;
  next?: CrmNextAction | null;
};

export type CrmActivity = {
  id: string;
  deal_id: string;
  kind: CrmActivityKind;
  due_at: string;
  status: CrmActivityStatus;
  created_at: string;
};

export type CrmDealCard = CrmDeal & {
  next_activity: CrmActivity | null;
};

export type CrmDealSearchHit = {
  dealId: string;
  pipelineId: string;
  pipelineNome: string;
  stageNome: string;
  company_name: string;
  contact_name: string;
  outcome: CrmOutcome;
};

export type CrmBoard = {
  pipeline: CrmPipeline;
  stages: CrmStage[];
  deals: CrmDealCard[];
};

export type CrmDealCreateInput = {
  pipelineId: string;
  stage_id?: string;
  company_name: string;
  contact_name?: string;
  secretaries?: string[];
  people?: CrmPerson[];
  phones?: string[];
  notes?: string;
  cnpj?: string | null;
  meta?: CrmDealMeta;
};

export type CrmDealPatch = {
  company_name?: string;
  contact_name?: string;
  secretaries?: string[];
  people?: CrmPerson[];
  phones?: string[];
  notes?: string;
  outcome?: CrmOutcome;
  amount_cents?: number | null;
  cnpj?: string | null;
  meta?: CrmDealMeta;
};

export type LeadCrmFirstMileStage = {
  key: FichaMoveKey;
  id: string;
  nome: string;
};

export type LeadCrmState = {
  dealId: string;
  pipelineId: string;
  pipelineNome: string;
  stageKey: CrmStageKey | null;
  stageNome: string;
  notes: string;
  firstMile: LeadCrmFirstMileStage[];
  pastFirstMile: boolean;
};
