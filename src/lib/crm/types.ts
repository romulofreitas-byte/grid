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

export type CrmDealMeta = {
  searchId?: string;
  ufs?: string[];
  municipioIds?: number[];
  source?: "qualify_bridge" | "catchup_bridge" | "crm_add";
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
