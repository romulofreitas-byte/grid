export const FUNNEL_STEPS = [
  { id: "signed_up", label: "Cadastro" },
  { id: "activated", label: "Ativou" },
  { id: "searched", label: "Buscou" },
  { id: "qualified", label: "Qualificou" },
  { id: "paid", label: "Pagou" },
] as const;

export type FunnelStepId = (typeof FUNNEL_STEPS)[number]["id"];

export type FunnelUser = {
  activated: boolean;
  searched: boolean;
  qualified: boolean;
  paid: boolean;
  recharged: boolean;
};

export type OpsFunnelStep = {
  id: FunnelStepId;
  label: string;
  count: number;
};

export type OpsFunnel = {
  steps: OpsFunnelStep[];
  recharged: number;
};

export function countFunnel(users: FunnelUser[]): OpsFunnel {
  return funnelFromCounts({
    signedUp: users.length,
    activated: users.filter((user) => user.activated).length,
    searched: users.filter((user) => user.searched).length,
    qualified: users.filter((user) => user.qualified).length,
    paid: users.filter((user) => user.paid).length,
    recharged: users.filter((user) => user.recharged).length,
  });
}

export function funnelFromCounts(input: {
  signedUp: number;
  activated: number;
  searched: number;
  qualified: number;
  paid: number;
  recharged: number;
}): OpsFunnel {
  return {
    steps: [
      { id: "signed_up", label: "Cadastro", count: input.signedUp },
      { id: "activated", label: "Ativou", count: input.activated },
      { id: "searched", label: "Buscou", count: input.searched },
      { id: "qualified", label: "Qualificou", count: input.qualified },
      { id: "paid", label: "Pagou", count: input.paid },
    ],
    recharged: input.recharged,
  };
}

export const EMPTY_FUNNEL = funnelFromCounts({
  signedUp: 0,
  activated: 0,
  searched: 0,
  qualified: 0,
  paid: 0,
  recharged: 0,
});
