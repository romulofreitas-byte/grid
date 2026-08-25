import type { LeadStatus } from "@/lib/types";

export const CRM_STAGE_KEYS = [
  "entrada",
  "tentando_contato",
  "contato_respondido",
  "followup_decisor",
  "reuniao_agendada",
  "reuniao_realizada",
  "ajustando_proposta",
  "proposta_apresentada",
  "negociacao",
  "contrato_fechado",
  "descartado",
] as const;

export type CrmStageKey = (typeof CRM_STAGE_KEYS)[number];

export const FIRST_MILE_KEYS = [
  "entrada",
  "tentando_contato",
  "contato_respondido",
  "followup_decisor",
  "reuniao_agendada",
] as const;

export type FirstMileKey = (typeof FIRST_MILE_KEYS)[number];

export const LOCKED_STAGE_KEYS = [...FIRST_MILE_KEYS, "descartado"] as const;

export const FICHA_MOVE_KEYS = [...FIRST_MILE_KEYS, "descartado"] as const;

export type FichaMoveKey = (typeof FICHA_MOVE_KEYS)[number];

export type CadenceEntry = {
  key: CrmStageKey;
  nome: string;
};

export const DEFAULT_CADENCE_ENTRIES: readonly CadenceEntry[] = [
  { key: "entrada", nome: "Entrada de Lista" },
  { key: "tentando_contato", nome: "Tentando Contato" },
  { key: "contato_respondido", nome: "Contato Respondido" },
  { key: "followup_decisor", nome: "Follow UP Decisor" },
  { key: "reuniao_agendada", nome: "Reunião Agendada" },
  { key: "reuniao_realizada", nome: "Reunião Realizada (R1)" },
  { key: "ajustando_proposta", nome: "Ajustando Proposta" },
  { key: "proposta_apresentada", nome: "Proposta Apresentada (R2)" },
  { key: "negociacao", nome: "Negociação e Fechamento" },
  { key: "contrato_fechado", nome: "Contrato fechado" },
  { key: "descartado", nome: "Descartado" },
] as const;

export const DEFAULT_CADENCE = DEFAULT_CADENCE_ENTRIES.map((entry) => entry.nome);

export const DEFAULT_PIPELINE_NAME = "Meu nicho";

export const FIRST_MILE_CHIP_LABELS: Record<FichaMoveKey, string> = {
  entrada: "Entrada",
  tentando_contato: "Tentando",
  contato_respondido: "Respondido",
  followup_decisor: "Follow-up",
  reuniao_agendada: "Reunião",
  descartado: "Descartado",
};

const STAGE_KEY_SET = new Set<string>(CRM_STAGE_KEYS);
const FIRST_MILE_SET = new Set<string>(FIRST_MILE_KEYS);
const LOCKED_SET = new Set<string>(LOCKED_STAGE_KEYS);
const FICHA_MOVE_SET = new Set<string>(FICHA_MOVE_KEYS);

export function cloneDefaultCadence(): string[] {
  return [...DEFAULT_CADENCE];
}

export function cloneDefaultCadenceEntries(): CadenceEntry[] {
  return DEFAULT_CADENCE_ENTRIES.map((entry) => ({ ...entry }));
}

export function isCrmStageKey(value: string | null | undefined): value is CrmStageKey {
  return Boolean(value && STAGE_KEY_SET.has(value));
}

export function isFirstMileKey(value: string | null | undefined): value is FirstMileKey {
  return Boolean(value && FIRST_MILE_SET.has(value));
}

export function isLockedStageKey(value: string | null | undefined): boolean {
  return Boolean(value && LOCKED_SET.has(value));
}

export function isFichaMoveKey(value: string | null | undefined): value is FichaMoveKey {
  return Boolean(value && FICHA_MOVE_SET.has(value));
}

export function isPastFirstMile(key: string | null | undefined): boolean {
  if (key === "descartado") return false;
  if (!key) return true;
  return !isFirstMileKey(key);
}

export function leadStatusFromStageKey(
  key: string | null | undefined,
): LeadStatus {
  if (key === "entrada") return "novo";
  if (key === "descartado") return "descartado";
  if (key === "reuniao_agendada" || isPastFirstMile(key)) return "reuniao";
  if (isFirstMileKey(key)) return "ligando";
  return "novo";
}

export function canMoveFromFicha(
  currentKey: string | null | undefined,
  targetKey: string,
): boolean {
  if (isPastFirstMile(currentKey)) return false;
  return isFichaMoveKey(targetKey);
}

export function callAdvanceTarget(
  currentKey: string | null | undefined,
): "tentando_contato" | null {
  return currentKey === "entrada" ? "tentando_contato" : null;
}

export function dispositionAdvanceTarget(
  status: LeadStatus,
  currentKey: string | null | undefined,
): FichaMoveKey | null {
  if (isPastFirstMile(currentKey)) return null;
  if (status === "reuniao") return "reuniao_agendada";
  if (status === "descartado") return "descartado";
  if (status === "ligando") return callAdvanceTarget(currentKey);
  return null;
}

export function pickEntradaStage<T extends { canonical_key: string | null }>(
  stages: T[],
): T | undefined {
  return (
    stages.find((stage) => stage.canonical_key === "entrada") ?? stages[0]
  );
}

export function pickStageByKey<T extends { canonical_key: string | null }>(
  stages: T[],
  key: string,
): T | undefined {
  return stages.find((stage) => stage.canonical_key === key);
}

export function firstMileStages<
  T extends { canonical_key: string | null },
>(stages: T[]): T[] {
  const byKey = new Map(
    stages
      .filter((stage) => isFichaMoveKey(stage.canonical_key))
      .map((stage) => [stage.canonical_key, stage]),
  );
  return FICHA_MOVE_KEYS.map((key) => byKey.get(key)).filter(
    (stage): stage is T => Boolean(stage),
  );
}
