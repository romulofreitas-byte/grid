import { isLockedStageKey } from "@/lib/crm/cadence";

export type DeleteStagePlan =
  | { ok: true; moveToStageId: string | null }
  | { ok: false; error: string };

export function planDeleteStage(input: {
  stages: Array<{ id: string; canonical_key?: string | null }>;
  stageId: string;
  dealCount: number;
  moveToStageId?: string | null;
}): DeleteStagePlan {
  const { stages, stageId, dealCount, moveToStageId } = input;
  const target = stages.find((stage) => stage.id === stageId);
  if (!target) {
    return { ok: false, error: "Faixa não encontrada." };
  }
  if (isLockedStageKey(target.canonical_key)) {
    return {
      ok: false,
      error: "Esta faixa faz parte da ficha. Dá para renomear, não apagar.",
    };
  }
  if (stages.length <= 1) {
    return { ok: false, error: "A pista precisa de pelo menos uma faixa." };
  }
  if (dealCount <= 0) {
    return { ok: true, moveToStageId: null };
  }
  if (!moveToStageId) {
    return {
      ok: false,
      error: "Escolha para onde vão os negócios desta faixa.",
    };
  }
  if (
    moveToStageId === stageId ||
    !stages.some((stage) => stage.id === moveToStageId)
  ) {
    return {
      ok: false,
      error: "Escolha outra faixa para receber os negócios.",
    };
  }
  return { ok: true, moveToStageId };
}

export function insertAt<T>(list: T[], index: number, item: T): T[] {
  const next = list.filter((entry) => entry !== item);
  const clamped = Math.max(0, Math.min(index, next.length));
  next.splice(clamped, 0, item);
  return next;
}
