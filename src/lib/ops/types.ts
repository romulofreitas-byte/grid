import type { OpsCohort } from "@/lib/ops/classify";
import type { OpsFunnel } from "@/lib/ops/funnel";
import type {
  OpsCnaeCount,
  OpsNicheCount,
  OpsNicheUfCell,
  OpsUfCount,
} from "@/lib/ops/market";
import type { OpsRange } from "@/lib/ops/filters";
import type {
  BillingOrder,
  BillingSubscription,
  CreditBalance,
  CreditLot,
  LedgerEntry,
} from "@/lib/billing/types";

export type OpsUsageCounts = {
  searchesTotal: number;
  searchesPeriod: number;
  enrichTotal: number;
  enrichPeriod: number;
  callsTotal: number;
  callsPeriod: number;
};

export type OpsRevenue = {
  totalCents: number;
  periodCents: number;
  last30dCents: number;
  monthCents: number;
  byKind: { kind: string; cents: number }[];
};

export type OpsCredits = {
  remaining: number;
  spent: number;
  spentPeriod: number;
  packRemaining: number;
  packSpentPeriod: number;
  bySource: { source: string; remaining: number }[];
  debitByReason: { reason: string; amount: number }[];
};

export type OpsDayCohort = {
  day: string;
  active: number;
  trial: number;
  free: number;
};

export type OpsUsageDay = {
  day: string;
  searches: number;
  enrich: number;
  calls: number;
};

export type OpsRevenueDay = {
  day: string;
  subscription_cycle: number;
  credit_pack: number;
  platform: number;
};

export type OpsPackMix = {
  sku: string;
  orders: number;
  users: number;
  cents: number;
};

export type OpsRechargeStats = {
  users: number;
  orders: number;
  cents: number;
  activeUsers: number;
  activeRecharged: number;
  enrichRecharged: number;
  enrichNotRecharged: number;
  usersRecharged: number;
  usersNotRecharged: number;
};

export type OpsMetrics = {
  range: OpsRange;
  users: number;
  active: number;
  trial: number;
  free: number;
  activated: number;
  byPlan: Record<string, number>;
  mrrCents: number;
  canceling: number;
  pastDue: number;
  revenue: OpsRevenue;
  credits: OpsCredits;
  usage: OpsUsageCounts;
  funnel: OpsFunnel;
  signups: OpsDayCohort[];
  niches: OpsNicheCount[];
  segments: OpsNicheCount[];
  ufs: OpsUfCount[];
  nicheUf: OpsNicheUfCell[];
  cnaes: OpsCnaeCount[];
  cnaeEnrich: OpsCnaeCount[];
  cnaeCalls: OpsCnaeCount[];
  intentSearches: number;
  enrichSeries: { day: string; count: number }[];
  packs: OpsPackMix[];
  recharge: OpsRechargeStats;
  revenueSeries: OpsRevenueDay[];
  usageSeries: OpsUsageDay[];
  jobStatus: { status: string; count: number }[];
};

export type OpsUserListItem = {
  id: string;
  email: string | null;
  nome: string | null;
  empresa: string | null;
  plan: string;
  cohort: OpsCohort;
  status: string | null;
  credits: number;
  activated: boolean;
  ltvCents: number;
  createdAt: string;
  periodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  recharged: boolean;
  enrichInPeriod: number;
};

export type OpsUserListPage = {
  users: OpsUserListItem[];
  total: number;
};

export type OpsUserDetail = OpsUserListItem & {
  especialidade: string | null;
  cidade: string | null;
  onboardingCompletedAt: string | null;
  platformTrialUsed: boolean;
  usage: {
    searches: number;
    enrich: number;
    calls: number;
    savedLeads: number;
  };
  balance: CreditBalance;
  subscription: BillingSubscription | null;
  orders: BillingOrder[];
  ledger: LedgerEntry[];
  lots: CreditLot[];
};
