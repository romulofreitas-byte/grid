export const PLANOS_URL = "/planos";
export const RECARGA_URL = "/planos#recarga";

export type BillingGateCode = "plan_required" | "insufficient_credits" | "trial_expired";
export type PaywallKind = "plan" | "credits" | "trial";
export type PaywallFeature = "qualify" | "export" | "crm_push" | "crm";

export type BillingGate = {
  kind: PaywallKind;
  needed?: number;
  available?: number;
  upgradeUrl: string;
};

export type PaywallOpen = {
  kind: PaywallKind;
  feature: PaywallFeature;
  needed?: number;
  available?: number;
};

export type PaywallCopy = {
  eyebrow: string;
  title: string;
  body: string;
  primary: { href: string; label: string };
  secondary:
    | { href: string; label: string }
    | { action: "close"; label: string };
};

export function planRequiredPayload(error: string, code: BillingGateCode = "plan_required") {
  return {
    error,
    code,
    upgradeUrl: code === "trial_expired" ? RECARGA_URL : PLANOS_URL,
  };
}

export function insufficientCreditsPayload(needed: number, available: number) {
  return {
    error: "Créditos insuficientes",
    code: "insufficient_credits" as const,
    needed,
    available,
    upgradeUrl: PLANOS_URL,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function parseBillingGate(
  status: number,
  body: unknown,
): BillingGate | null {
  const json = isRecord(body) ? body : {};
  const code = typeof json.code === "string" ? json.code : "";
  const error = typeof json.error === "string" ? json.error : "";
  const needed = readNumber(json.needed);
  const available = readNumber(json.available);
  const upgradeUrl =
    typeof json.upgradeUrl === "string" && json.upgradeUrl
      ? json.upgradeUrl
      : PLANOS_URL;

  if (code === "trial_expired") {
    return { kind: "trial", upgradeUrl };
  }
  if (code === "plan_required") {
    return { kind: "plan", upgradeUrl };
  }
  if (code === "insufficient_credits") {
    return { kind: "credits", needed, available, upgradeUrl };
  }

  if (
    status === 403 &&
    (error.includes("30 dias") || error.includes("trial"))
  ) {
    return { kind: "trial", upgradeUrl: upgradeUrl || RECARGA_URL };
  }
  if (
    status === 403 &&
    (error.includes("Treino livre") || error.includes("Qualificação"))
  ) {
    return { kind: "plan", upgradeUrl };
  }
  if (status === 402) {
    return { kind: "credits", needed, available, upgradeUrl };
  }
  if (error.includes("Treino livre")) {
    return { kind: "plan", upgradeUrl };
  }
  return null;
}

export class BillingGateError extends Error {
  gate: BillingGate;
  constructor(gate: BillingGate) {
    super("billing_gate");
    this.name = "BillingGateError";
    this.gate = gate;
  }
}

export function isBillingGateError(err: unknown): err is BillingGateError {
  return (
    err instanceof BillingGateError ||
    (err instanceof Error && err.name === "BillingGateError")
  );
}

export function throwIfBillingGate(
  status: number,
  body: unknown,
  openPaywall: (input: PaywallOpen) => void,
  feature: PaywallFeature,
): void {
  const gate = parseBillingGate(status, body);
  if (!gate) return;
  openPaywall({
    kind: gate.kind,
    feature,
    needed: gate.needed,
    available: gate.available,
  });
  throw new BillingGateError(gate);
}

export function blockQualifyIfFree(
  enrichAllowed: boolean | undefined,
  openPaywall: (input: PaywallOpen) => void,
  options?: { trialExpired?: boolean },
): boolean {
  if (enrichAllowed !== false) return false;
  openPaywall({
    kind: options?.trialExpired ? "trial" : "plan",
    feature: "qualify",
  });
  return true;
}

export function blockCrmIfFree(
  enrichAllowed: boolean | undefined,
  openPaywall: (input: PaywallOpen) => void,
  options?: { trialExpired?: boolean },
): boolean {
  if (enrichAllowed !== false) return false;
  openPaywall({
    kind: options?.trialExpired ? "trial" : "plan",
    feature: "crm",
  });
  return true;
}

export function paywallCopy(state: PaywallOpen): PaywallCopy {
  if (state.kind === "trial") {
    return {
      eyebrow: "30 dias",
      title: "O trial do Piloto acabou",
      body: "Recarregue para mais 30 dias de acesso ou assine o Piloto.",
      primary: { href: RECARGA_URL, label: "Recarregar" },
      secondary: { href: PLANOS_URL, label: "Ver planos" },
    };
  }
  if (state.kind === "plan") {
    if (state.feature === "crm") {
      return {
        eyebrow: "Plano Piloto",
        title: "CRM só a partir do Plano Piloto",
        body: "Buscar e ver a lista continua grátis. A pista do nicho entra no Piloto.",
        primary: { href: PLANOS_URL, label: "Ver planos" },
        secondary: { action: "close", label: "Fechar" },
      };
    }
    return {
      eyebrow: "Plano Piloto",
      title: "Qualificação só a partir do Plano Piloto",
      body: "Buscar e ver a lista continua grátis. Cruzar site, redes e mapas entra no Piloto.",
      primary: { href: PLANOS_URL, label: "Ver planos" },
      secondary: { action: "close", label: "Fechar" },
    };
  }

  const counts =
    state.needed != null && state.available != null
      ? `Esta ação precisa de ${state.needed} créditos. Você tem ${state.available} disponíveis.`
      : "Faltam créditos para esta ação.";

  return {
    eyebrow: "Créditos",
    title: "Faltam créditos",
    body: `${counts} Recarregue para continuar — pacotes não substituem o plano.`,
    primary: { href: RECARGA_URL, label: "Recarregar" },
    secondary: { href: PLANOS_URL, label: "Ver planos" },
  };
}
