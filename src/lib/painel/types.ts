export const PAINEL_RANGES = ["today", "7d", "30d", "month", "all"] as const;
export type PainelRange = (typeof PAINEL_RANGES)[number];

export type PainelNamedCount = {
  id: string;
  name: string;
  value: number;
};

export type PainelFunnelStep = {
  id: string;
  label: string;
  count: number;
};

export type PainelDayPoint = {
  day: string;
  calls: number;
  meta: number;
};

export type PainelTaskRow = {
  id: string;
  kind: "overdue" | "won";
  companyName: string;
  subtitle: string;
  dealId: string;
  pipelineId: string;
  pipelineNome: string | null;
  amountCents: number | null;
  overdueDays: number | null;
};

export type PainelPipelineOption = {
  id: string;
  nome: string;
  openDeals: number;
};

export type PainelKpis = {
  callsToday: number;
  callGoal: number;
  streak: number;
  overdueFollowups: number;
  billedPeriodCents: number;
  pipelineOpenCents: number;
  wonPeriod: number;
  lostPeriod: number;
  wonWithoutAmount: number;
  openDeals: number;
  openWithAmount: number;
  openWithoutNext: number;
};

export type PainelMetrics = {
  range: PainelRange;
  pipelineId: string | null;
  suggestedPipelineId: string | null;
  crmAllowed: boolean;
  trialExpired: boolean;
  pipelines: PainelPipelineOption[];
  kpis: PainelKpis;
  funnel: PainelFunnelStep[];
  pipeline: PainelNamedCount[];
  followups: PainelNamedCount[];
  outcomes: PainelNamedCount[];
  lists: {
    generated: number;
    saved: number;
    leadStatus: PainelNamedCount[];
  };
  habit: PainelDayPoint[];
  tasks: PainelTaskRow[];
};

export type PainelDealRow = {
  id: string;
  company_name: string;
  pipeline_id: string;
  stage_id: string;
  stage_nome: string;
  canonical_key: string | null;
  outcome: "open" | "won" | "lost";
  amount_cents: number | null;
  created_at: string;
  updated_at: string;
};

export type PainelActivityRow = {
  deal_id: string;
  kind: string;
  due_at: string;
  status: "open" | "done";
};

export type PainelOutcomeEvent = {
  deal_id: string;
  created_at: string;
  outcome: "open" | "won" | "lost" | null;
};

export type PainelSnapshot = {
  now: Date;
  range: PainelRange;
  pipelineId: string | null;
  callGoal: number;
  callCreatedAt: string[];
  searches: { created_at: string; saved: boolean }[];
  leads: { status: string }[];
  pipelines: PainelPipelineOption[];
  deals: PainelDealRow[];
  activities: PainelActivityRow[];
  outcomeEvents: PainelOutcomeEvent[];
};
