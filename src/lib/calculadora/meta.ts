import {
  calculateFunnel,
  defaultFunnelPlan,
  sanitizeFunnelPlanPatch,
  TAXAS_ORIGEM,
  type FunnelPlan,
  type TaxasOrigem,
} from "@/lib/calculadora/funnel";
import { clampCallGoal } from "@/lib/pilot-profile";

export const META_NAME_MAX = 80;
export const META_TIPO_MAX = 80;

export type MetaInput = {
  nome: string;
  tipo_empresa: string;
  metaFaturamento: number;
  ticket: number;
  prazoMeses: number;
  taxa1: number;
  taxa2: number;
  taxa3: number;
  taxa4: number;
  taxasOrigem: TaxasOrigem;
};

export type PilotMeta = MetaInput & {
  id: string;
  user_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type MetaApplyResult =
  | { status: "ok"; meta: PilotMeta; metaLigacoesDia: number }
  | { status: "not_found" }
  | { status: "not_ready" };

function clip(value: unknown, max: number): string {
  if (value == null) return "";
  return String(value).trim().slice(0, max);
}

export function defaultMetaInput(): MetaInput {
  const plan = defaultFunnelPlan();
  return {
    nome: "",
    tipo_empresa: "",
    metaFaturamento: plan.metaFaturamento,
    ticket: plan.ticket,
    prazoMeses: plan.prazoMeses,
    taxa1: plan.taxa1,
    taxa2: plan.taxa2,
    taxa3: plan.taxa3,
    taxa4: plan.taxa4,
    taxasOrigem: plan.taxasOrigem,
  };
}

export function funnelFromMeta(meta: MetaInput): FunnelPlan {
  return {
    metaFaturamento: meta.metaFaturamento,
    ticket: meta.ticket,
    prazoMeses: meta.prazoMeses,
    taxa1: meta.taxa1,
    taxa2: meta.taxa2,
    taxa3: meta.taxa3,
    taxa4: meta.taxa4,
    taxasOrigem: meta.taxasOrigem,
    appliedAt: null,
  };
}

export function dailyGoalFromMeta(meta: MetaInput, now = new Date()): number | null {
  const result = calculateFunnel({ ...funnelFromMeta(meta), now });
  if (!result.ready || result.ligacoesPorDia < 1) return null;
  return clampCallGoal(result.ligacoesPorDia);
}

export function sanitizeMetaCreate(
  body: unknown,
): { ok: true; value: MetaInput } | { ok: false; error: string } {
  const row =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const nome = clip(row.nome, META_NAME_MAX);
  if (!nome) return { ok: false, error: "Dê um nome à meta." };
  const plan = sanitizeFunnelPlanPatch(row);
  return {
    ok: true,
    value: {
      nome,
      tipo_empresa: clip(row.tipo_empresa ?? row.tipoEmpresa, META_TIPO_MAX),
      metaFaturamento: plan.metaFaturamento,
      ticket: plan.ticket,
      prazoMeses: plan.prazoMeses,
      taxa1: plan.taxa1,
      taxa2: plan.taxa2,
      taxa3: plan.taxa3,
      taxa4: plan.taxa4,
      taxasOrigem: plan.taxasOrigem,
    },
  };
}

export function sanitizeMetaUpdate(body: unknown): Partial<MetaInput> {
  if (!body || typeof body !== "object") return {};
  const row = body as Record<string, unknown>;
  const patch: Partial<MetaInput> = {};
  if ("nome" in row) {
    const nome = clip(row.nome, META_NAME_MAX);
    if (nome) patch.nome = nome;
  }
  if ("tipo_empresa" in row || "tipoEmpresa" in row) {
    patch.tipo_empresa = clip(row.tipo_empresa ?? row.tipoEmpresa, META_TIPO_MAX);
  }
  const planKeys = [
    "metaFaturamento",
    "ticket",
    "prazoMeses",
    "taxa1",
    "taxa2",
    "taxa3",
    "taxa4",
    "taxasOrigem",
  ] as const;
  const hasPlan = planKeys.some((key) => key in row);
  if (hasPlan) {
    const plan = sanitizeFunnelPlanPatch({
      ...defaultFunnelPlan(),
      ...row,
    });
    if ("metaFaturamento" in row) patch.metaFaturamento = plan.metaFaturamento;
    if ("ticket" in row) patch.ticket = plan.ticket;
    if ("prazoMeses" in row) patch.prazoMeses = plan.prazoMeses;
    if ("taxa1" in row) patch.taxa1 = plan.taxa1;
    if ("taxa2" in row) patch.taxa2 = plan.taxa2;
    if ("taxa3" in row) patch.taxa3 = plan.taxa3;
    if ("taxa4" in row) patch.taxa4 = plan.taxa4;
    if ("taxasOrigem" in row) patch.taxasOrigem = plan.taxasOrigem;
  }
  return patch;
}

export function parseTaxasOrigem(value: unknown): TaxasOrigem {
  return TAXAS_ORIGEM.includes(value as TaxasOrigem)
    ? (value as TaxasOrigem)
    : "padrao";
}
