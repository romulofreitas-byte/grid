import type { OpsCohort } from "@/lib/ops/classify";
import type {
  BillingOrder,
  BillingSubscription,
  CreditBalance,
  CreditLot,
  LedgerEntry,
} from "@/lib/billing/types";

export type OpsUsageCounts = {
  searchesTotal: number;
  searches7d: number;
  enrichTotal: number;
  enrich7d: number;
  callsTotal: number;
  calls7d: number;
};

export type OpsRevenue = {
  totalCents: number;
  last30dCents: number;
  monthCents: number;
};

export type OpsCredits = {
  remaining: number;
  spent: number;
};

export type OpsMetrics = {
  users: number;
  active: number;
  trial: number;
  free: number;
  activated: number;
  byPlan: Record<string, number>;
  mrrCents: number;
  revenue: OpsRevenue;
  credits: OpsCredits;
  usage: OpsUsageCounts;
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
