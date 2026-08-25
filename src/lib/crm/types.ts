import type { CrmStageKey, FichaMoveKey } from "@/lib/crm/cadence";

export const CRM_ACTIVITY_KINDS = [
  "ligar",
  "whatsapp",
  "reuniao",
  "followup",
  "proposta",
] as const;

export type CrmActivityKind = (typeof CRM_ACTIVITY_KINDS)[number];

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
  source?: "qualify_bridge" | "catchup_bridge";
};

export type CrmDeal = {
  id: string;
  pipeline_id: string;
  stage_id: string;
  company_name: string;
  contact_name: string;
  secretaries: string[];
  phones: string[];
  notes: string;
  /** Digits-only CNPJ when bridged from Grid qualify; null for manual deals. */
  cnpj: string | null;
  meta: CrmDealMeta;
  position: number;
  created_at: string;
  updated_at: string;
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
  phones?: string[];
  notes?: string;
};

export type CrmNextAction = {
  kind: CrmActivityKind;
  dueAt: string;
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
