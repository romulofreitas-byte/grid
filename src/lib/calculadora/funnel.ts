export const DEFAULT_TAXAS = {
  taxa1: 20,
  taxa2: 70,
  taxa3: 80,
  taxa4: 50,
} as const;

export const DIALS_PER_EFFECTIVE = 3;
export const PROSPECTING_DAYS_PER_WEEK = 3;

export const TAXAS_ORIGEM = ["padrao", "crm", "manual"] as const;
export type TaxasOrigem = (typeof TAXAS_ORIGEM)[number];

export type FunnelPlan = {
  metaFaturamento: number;
  ticket: number;
  prazoMeses: number;
  taxa1: number;
  taxa2: number;
  taxa3: number;
  taxa4: number;
  taxasOrigem: TaxasOrigem;
  appliedAt: string | null;
};

export type FunnelInput = {
  metaFaturamento: number;
  ticket: number;
  taxa1: number;
  taxa2: number;
  taxa3: number;
  taxa4: number;
  prazoMeses: number;
  now?: Date;
};

export type FunnelResult = {
  contratos: number;
  negociacoes: number;
  r2: number;
  r1: number;
  ligacoesDecisor: number;
  ligacoesTotais: number;
  semanas: number;
  diasProspeccao: number;
  ligacoesPorDia: number;
  dataFinal: Date | null;
  ready: boolean;
};

export function defaultFunnelPlan(): FunnelPlan {
  return {
    metaFaturamento: 0,
    ticket: 0,
    prazoMeses: 0,
    taxa1: DEFAULT_TAXAS.taxa1,
    taxa2: DEFAULT_TAXAS.taxa2,
    taxa3: DEFAULT_TAXAS.taxa3,
    taxa4: DEFAULT_TAXAS.taxa4,
    taxasOrigem: "padrao",
    appliedAt: null,
  };
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function clampPercent(value: unknown, fallback: number): number {
  const n = finiteNumber(value);
  if (n == null || n <= 0) return fallback;
  return Math.min(100, n);
}

function toRate(percent: number, fallbackPercent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return fallbackPercent / 100;
  return percent / 100;
}

export function emptyFunnelResult(): FunnelResult {
  return {
    contratos: 0,
    negociacoes: 0,
    r2: 0,
    r1: 0,
    ligacoesDecisor: 0,
    ligacoesTotais: 0,
    semanas: 0,
    diasProspeccao: 0,
    ligacoesPorDia: 0,
    dataFinal: null,
    ready: false,
  };
}

export function calculateFunnel(input: FunnelInput): FunnelResult {
  const meta = finiteNumber(input.metaFaturamento) ?? 0;
  const ticket = finiteNumber(input.ticket) ?? 0;
  const taxa1 = toRate(input.taxa1, DEFAULT_TAXAS.taxa1);
  const taxa2 = toRate(input.taxa2, DEFAULT_TAXAS.taxa2);
  const taxa3 = toRate(input.taxa3, DEFAULT_TAXAS.taxa3);
  const taxa4 = toRate(input.taxa4, DEFAULT_TAXAS.taxa4);

  if (meta <= 0 || ticket <= 0) return emptyFunnelResult();

  const contratos = Math.ceil(meta / ticket);
  const negociacoes = Math.ceil(contratos / taxa4);
  const r2 = Math.ceil(negociacoes / taxa3);
  const r1 = Math.ceil(r2 / taxa2);
  const ligacoesDecisor = Math.ceil(r1 / taxa1);

  const prazoMeses = Math.max(0, Math.floor(finiteNumber(input.prazoMeses) ?? 0));
  if (prazoMeses <= 0 || ligacoesDecisor <= 0) {
    return {
      contratos,
      negociacoes,
      r2,
      r1,
      ligacoesDecisor,
      ligacoesTotais: 0,
      semanas: 0,
      diasProspeccao: 0,
      ligacoesPorDia: 0,
      dataFinal: null,
      ready: false,
    };
  }

  const now = input.now ?? new Date();
  const dataFinal = new Date(now);
  dataFinal.setMonth(dataFinal.getMonth() + prazoMeses);
  const diffMs = Math.max(0, dataFinal.getTime() - now.getTime());
  const semanas = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7)));
  const diasProspeccao = semanas * PROSPECTING_DAYS_PER_WEEK;
  const ligacoesTotais = ligacoesDecisor * DIALS_PER_EFFECTIVE;
  const ligacoesPorDia = Math.ceil(ligacoesTotais / diasProspeccao);

  return {
    contratos,
    negociacoes,
    r2,
    r1,
    ligacoesDecisor,
    ligacoesTotais,
    semanas,
    diasProspeccao,
    ligacoesPorDia,
    dataFinal,
    ready: true,
  };
}

export function parseFunnelPlan(raw: unknown): FunnelPlan | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return parseFunnelPlan(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const origem = TAXAS_ORIGEM.includes(row.taxasOrigem as TaxasOrigem)
    ? (row.taxasOrigem as TaxasOrigem)
    : "padrao";
  const appliedAt =
    typeof row.appliedAt === "string" && row.appliedAt.trim()
      ? row.appliedAt
      : null;
  return {
    metaFaturamento: Math.max(0, finiteNumber(row.metaFaturamento) ?? 0),
    ticket: Math.max(0, finiteNumber(row.ticket) ?? 0),
    prazoMeses: Math.max(0, Math.floor(finiteNumber(row.prazoMeses) ?? 0)),
    taxa1: clampPercent(row.taxa1, DEFAULT_TAXAS.taxa1),
    taxa2: clampPercent(row.taxa2, DEFAULT_TAXAS.taxa2),
    taxa3: clampPercent(row.taxa3, DEFAULT_TAXAS.taxa3),
    taxa4: clampPercent(row.taxa4, DEFAULT_TAXAS.taxa4),
    taxasOrigem: origem,
    appliedAt,
  };
}

export function sanitizeFunnelPlanPatch(body: unknown): FunnelPlan {
  const parsed = parseFunnelPlan(body);
  if (!parsed) return defaultFunnelPlan();
  return parsed;
}

export function funnelPlanApplied(plan: FunnelPlan | null | undefined): boolean {
  return Boolean(plan?.appliedAt);
}
