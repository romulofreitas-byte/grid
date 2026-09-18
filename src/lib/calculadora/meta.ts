import {
  calculateFunnel,
  defaultFunnelPlan,
  DEFAULT_TAXAS,
  sanitizeFunnelPlanPatch,
  TAXAS_ORIGEM,
  type FunnelPlan,
  type TaxasOrigem,
} from "@/lib/calculadora/funnel";
import { clampCallGoal } from "@/lib/pilot-profile";

export const META_NAME_MAX = 80;
export const META_TIPO_MAX = 80;
export const METAS_SCHEMA_MISSING =
  "A tabela de metas ainda não está no banco.";

export type MetaInput = {
  nome: string;
  tipo_empresa: string;
  metaFaturamento: number;
  ticket: number;
  prazoMeses: number;
  taxaContato: number;
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
    taxaContato: plan.taxaContato,
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
    taxaContato: meta.taxaContato || DEFAULT_TAXAS.taxaContato,
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
      taxaContato: plan.taxaContato,
      taxa1: plan.taxa1,
      taxa2: plan.taxa2,
      taxa3: plan.taxa3,
      taxa4: plan.taxa4,
      taxasOrigem: plan.taxasOrigem,
    },
  };
}

const META_PLAN_KEYS = [
  ["metaFaturamento", "meta_faturamento"],
  ["ticket"],
  ["prazoMeses", "prazo_meses"],
  ["taxaContato", "taxa_contato"],
  ["taxa1"],
  ["taxa2"],
  ["taxa3"],
  ["taxa4"],
  ["taxasOrigem", "taxas_origem"],
] as const;

function rowHas(row: Record<string, unknown>, ...keys: readonly string[]): boolean {
  return keys.some((key) => key in row);
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
  const hasPlan = META_PLAN_KEYS.some((keys) => rowHas(row, ...keys));
  if (hasPlan) {
    const plan = sanitizeFunnelPlanPatch(row);
    if (rowHas(row, "metaFaturamento", "meta_faturamento")) {
      patch.metaFaturamento = plan.metaFaturamento;
    }
    if (rowHas(row, "ticket")) patch.ticket = plan.ticket;
    if (rowHas(row, "prazoMeses", "prazo_meses")) patch.prazoMeses = plan.prazoMeses;
    if (rowHas(row, "taxaContato", "taxa_contato")) {
      patch.taxaContato = plan.taxaContato;
    }
    if (rowHas(row, "taxa1")) patch.taxa1 = plan.taxa1;
    if (rowHas(row, "taxa2")) patch.taxa2 = plan.taxa2;
    if (rowHas(row, "taxa3")) patch.taxa3 = plan.taxa3;
    if (rowHas(row, "taxa4")) patch.taxa4 = plan.taxa4;
    if (rowHas(row, "taxasOrigem", "taxas_origem")) {
      patch.taxasOrigem = plan.taxasOrigem;
    }
  }
  return patch;
}

export function parseTaxasOrigem(value: unknown): TaxasOrigem {
  return TAXAS_ORIGEM.includes(value as TaxasOrigem)
    ? (value as TaxasOrigem)
    : "padrao";
}

export function sortMetasForList(
  metas: readonly PilotMeta[],
  activeMetaId: string | null,
): PilotMeta[] {
  return metas.slice().sort((a, b) => {
    if (activeMetaId) {
      if (a.id === activeMetaId) return -1;
      if (b.id === activeMetaId) return 1;
    }
    return b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id);
  });
}
